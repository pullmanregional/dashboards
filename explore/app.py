# Add main repo directory to include path to access common/ modules
import sys, os

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))


import streamlit as st
from src import route, ui
from src.model import source_data
from src.ui import explore
from common import auth, st_util


def run():
    """Main streamlit app entry point"""
    # Authenticate user
    user = auth.oidc_auth()
    if not user:
        return st.stop()

    # Read, parse, and cache (via @st.cache_data) source data
    src_data = source_data.read()

    # Handle routing based on query parameters
    route_id = route.route_by_query(st.query_params)

    # Check for API resources first
    if route_id == route.CLEAR_CACHE:
        return st_util.st_clear_cache_page()

    # Render page based on the route
    if src_data is None:
        st_util.st_center_text("No data available. Please contact administrator.")
    else:
        return explore.show(src_data)


# App config
st.set_page_config(
    page_title="Data Analytics Home",
    page_icon=":material/graph_6:",
    layout="wide",
    initial_sidebar_state="collapsed",
    menu_items=None,
)
hide_streamlit_style = """
            <style>
                /* Hide the Streamlit header and menu, see https://discuss.streamlit.io/t/hiding-the-header-in-1-31-1/63398/2 */
                header {visibility: hidden;}
                .stMainBlockContainer {padding-top: 2rem;}
            </style>
            """
st.markdown(hide_streamlit_style, unsafe_allow_html=True)

# st.set_page_config(
#     page_title="Data Explorer", layout="wide", initial_sidebar_state="auto"
# )
run()
