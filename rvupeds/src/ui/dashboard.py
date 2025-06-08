import streamlit as st
from ..model import source_data, app_data
from . import ui


def show(src_data: source_data.SourceData):
    """
    Main module entry point. Get user settings, prepare data, and show main page.
    """
    # Get sidebar user settings. Settings embedded in the content handled by ui module.
    settings = ui.show_settings(src_data)

    data = app_data.process(src_data)

    # Show main content
    ui.show_content(settings, data)
