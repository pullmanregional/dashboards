import streamlit as st
from ..model import source_data, app_data
from . import ui


def show(src_data: source_data.SourceData):
    """
    Main module entry point. Get user settings, prepare data, and show main page.
    """
    # Get sidebar user settings. Settings embedded in the content handled by ui module.
    settings = ui.show_settings(src_data)

    # Compute data for this provider and date range
    data, compare = None, None
    if settings.provider != "Select a Provider":
        data = app_data.process(
            src_data,
            settings.provider,
            settings.start_date,
            settings.end_date,
        )

        # Get comparison data if compare mode is enabled
        if settings.compare_start_date:
            compare = app_data.process(
                src_data,
                settings.provider,
                settings.compare_start_date,
                settings.compare_end_date,
            )

    # Show main content
    ui.show_content(settings, data, compare)
