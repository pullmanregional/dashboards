# Add main repo directory to include path to access common/ modules
import sys, pathlib

sys.path.append(str(pathlib.Path(__file__).parent.parent))


import streamlit as st
from src import route
from src.model import source_data
from src.ui import panel
from common import auth, st_util


def run():
    """Main streamlit app entry point"""
    # Fetch source data - do this before auth to ensure all requests to app cause data refresh
    # Read, parse, and cache (via @st.cache_data) source data
    with st.spinner("Initializing..."):
        src_data = source_data.from_s3()

    # Handle routing based on query parameters
    route_id = route.route_by_query(st.query_params)

    # Check for API resources first
    if route_id == route.CLEAR_CACHE:
        return st_util.st_clear_cache_page()

    # Render page based on the route
    if src_data is None:
        return st.write("No data available. Please contact administrator.")
    elif not auth.authenticate():
        return st.stop()
    else:
        return panel.show(src_data)


st.set_page_config(
    page_title="PRH Panel Explorer", layout="wide", initial_sidebar_state="auto"
)
run()
