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


def st_center_text(text: str, style: str = ""):
    """
    Write text in the center of the page using markdown and centered styling
    """
    st.markdown(
        f"""
        <div style="text-align: center; {style}">
            {text}
        </div>
        """,
        unsafe_allow_html=True,
    )


def st_card(title: str, content: str, description: str = ""):
    st.markdown(
        f"""
        <div style="
            padding: 0.6rem 1rem;
            border-radius: 8px;
            border: 1px solid #e0e0e0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin: 0.5rem 0;
        ">
            <h3 style="
                font-size: 1.2rem;
                margin: 0 0 0.2rem 0;
                padding: 0;
                color: #333;
            ">{title}</h3>
            <p style="
                font-size: 1.1rem;
                margin: 0 0 0.2rem 0;
                font-weight: 500;
            ">{content}</p>
            <p style="
                font-size: 0.75rem;
                margin: 0;
                color: #666;
            ">{description}</p>
        </div>
        """,
        unsafe_allow_html=True,
    )


def st_card_container(key: str, padding_css: str = "0px 16px"):
    from streamlit_extras.stylable_container import stylable_container
    with stylable_container(
        key=key,
        css_styles=f"""
            {{
                padding: {padding_css};
                border-radius: 8px;
                border: 1px solid #e0e0e0;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                margin: 0.5rem 0;
            }}
            """,
    ):
        return st.container()
