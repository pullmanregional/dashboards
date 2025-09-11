# Add main repo directory to include path to access common/ modules
import sys, os

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
from streamlit_extras.floating_button import floating_button
from src import route
from src.model import source_data
from src.dept import base
from common import auth, st_util


def run():
    """Main streamlit app entry point"""
    # Authenticate user
    # user = auth.oidc_auth()
    # if not user:
    #     return st.stop()

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
    elif route_id in route.DEPTS:
        return base.dept_page(src_data, route_id)
    else:
        return show_index()


def show_index():
    """
    Select and navigate to dashboards
    """
    # Add a logout link with an icon
    if floating_button("Log out", key="logout", icon=":material/logout:"):
        st.logout()
        st.rerun()

    # Create a dictionary mapping department names to their route IDs
    dept_options = {base.configs.DEPT_CONFIG[r].name: r for r in route.DEPTS}

    # Create a centered container for the UI elements
    col1, col2, col3 = st.columns([1, 2, 1])

    with col2:
        st.title("Pullman Regional Hospital")
        st.markdown("#### Select a Dashboard")
        # Create a combo box with all department options
        selected_dept_name = st.selectbox(
            "Select Dashboard",
            options=sorted(dept_options.keys()),
            label_visibility="collapsed",
        )

        # Get the route ID for the selected department
        selected_dept_id = dept_options[selected_dept_name]

        # Create a Go to Dashboard button
        if st.button("Go to Dashboard", use_container_width=True, type="primary"):
            # Set the query parameter and rerun the app
            st.query_params["dept"] = selected_dept_id
            st.rerun()

        # Generate the direct link URL with full current URL
        st.markdown(
            f"Link to share: https://data.prh.org/finance/?dept={selected_dept_id}"
        )


# App config
st.set_page_config(
    page_title="PRH Finance Dashboard",
    page_icon=":material/analytics:",
    layout="wide",
    initial_sidebar_state="expanded",
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
run()
