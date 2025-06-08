"""
Methods to show build streamlit UI
"""

from datetime import date
import streamlit as st
from ..model import source_data, app_data, settings
from . import dates


def show_settings(src_data: source_data.SourceData) -> settings.Settings:
    # Build left hand sidebar and return user chosen settings
    data_start_date, data_end_date = src_data.start_date, src_data.end_date
    start_date, end_date, compare_start_date, compare_end_date = None, None, None, None

    st.sidebar.title("RVU Dashboard")
    config_ct = st.sidebar

    # Filter options for providers
    provider = config_ct.selectbox(
        "Provider:",
        ["Select a Provider"] + src_data.providers,
    )

    # Preset date filters
    date_range = config_ct.selectbox(
        "Dates:",
        [
            "Specific dates",
            "Last 12 months",
            "This year",
            "Last year",
            "This quarter",
            "Last quarter",
            "This month",
            "Last month",
            "Last 4 completed quarters",
            "All dates",
        ],
        index=1,
    )
    if date_range == "Specific dates":
        specific_dates = config_ct.date_input(
            "Date range:", value=(data_start_date, date.today())
        )
        if len(specific_dates) > 1:
            # Wait until both start and end dates selected to set date range
            start_date, end_date = specific_dates
    elif date_range == "All dates":
        start_date, end_date = data_start_date, data_end_date
    else:
        start_date, end_date = dates.get_dates(date_range)

    # Add a logout link with an icon
    st.sidebar.markdown("---")
    if st.sidebar.button("Log out", icon=":material/logout:", use_container_width=True):
        st.logout()
        st.rerun()

    return settings.Settings(
        provider=provider, start_date=start_date, end_date=end_date
    )


def show_content(settings: settings.Settings, data: app_data.AppData):
    st.subheader("Section")
    st.write(data.data)
