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