import streamlit as st

def st_clear_cache_page():
    """
    Clear Streamlit cache so source_data module will reread DB from disk on next request
    """
    st.cache_data.clear()
    return st.markdown(
        'Cache cleared. <a href="/" target="_self">Return home.</a>',
        unsafe_allow_html=True,
    )


def st_sidebar_prh_logo(y: int = 20):
    """
    Add PRH Logo to side bar - https://discuss.streamlit.io/t/put-logo-and-title-above-on-top-of-page-navigation-in-sidebar-of-multipage-app/28213/5
    """
    st.markdown(
        f"""
        <style>
            [data-testid="stSidebar"] {{
                background-image: url(https://www.pullmanregional.org/hubfs/PullmanRegionalHospital_December2019/Image/logo.svg);
                background-repeat: no-repeat;
                padding-top: 0px;
                background-position: center {y}px;
            }}
            .element-container iframe {{
                min-height: 810px;
            }}
        </style>
        """,
        unsafe_allow_html=True,
    )
