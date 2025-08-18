"""
Methods to show build streamlit UI
"""

import streamlit as st
from ..model import source_data, app_data, settings


def show_settings(src_data: source_data.SourceData) -> settings.Settings:
    # Build left hand sidebar and return user chosen settings
    return settings.Settings()


def show_content(settings: settings.Settings, data: app_data.AppData):
    st.subheader("Section")
    st.write(data.data)
