# Displays a sign in page, function returns False if authentication fails,
# or True/user object on success
#
# simple_auth(): single password for app, stored in streamlit secrets
# oidc_auth(): use streamlit implemented OpenID Connect (OIDC) to connect to a
#   user provider (e.g. Microsoft Entra ID)
#
#

import streamlit as st

PAGE_TITLE = "Sign In"


def simple_auth():
    """Simple, non-encrypted password authentication stored in streamlit environment and session state"""

    def password_entered():
        """Called when password input changes"""
        if st.session_state["password"] == st.secrets["password"]:
            st.session_state["authn"] = True
            del st.session_state["password"]  # don't store password
        else:
            st.session_state["authn"] = False

    if "authn" not in st.session_state:
        # First run, show input for password.
        _, ct, _ = st.columns([1, 2, 1])
        ct.header(PAGE_TITLE)
        ct.text_input(
            "Password",
            type="password",
            autocomplete="current-password",
            on_change=password_entered,
            key="password",
        )
        return False
    elif not st.session_state["authn"]:
        # Password not correct, show input + error.
        _, ct, _ = st.columns([1, 2, 1])
        ct.header(PAGE_TITLE)
        ct.text_input(
            "Password",
            type="password",
            autocomplete="current-password",
            on_change=password_entered,
            key="password",
        )
        ct.error("Invalid password")
        return False
    else:
        return True


def oidc_auth():
    """OpenID Connect (OIDC) authentication using streamlit's built-in OIDC implementation"""
    if not st.experimental_user.is_logged_in:
        st.markdown(
            """
            <h3 style='text-align: center;'>Sign in with your organization</h3>
            """,
            unsafe_allow_html=True,
        )
        st.markdown(
            """
            <style>
                div.st-key-sign-in {
                    text-align: center;
                }
            </style>
            """,
            unsafe_allow_html=True,
        )
        st.button("Sign In", key="sign-in", on_click=st.login)
        return False

    return st.experimental_user
