"""
Methods to show build streamlit UI
"""

from datetime import date
import streamlit as st
import arrow
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

    # Option to compare to another date range
    config_ct.markdown("#")
    compare = config_ct.toggle("Compare to prior dates")
    if compare:
        compare_ct = config_ct.container()
        compare_date_range = compare_ct.selectbox(
            "Dates:",
            [
                "Specific dates",
                "Same days 1 month ago",
                "Same days 1 year ago",
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
            index=2,
            label_visibility="collapsed",
        )
        if compare_date_range == "Specific dates":
            compare_dates = compare_ct.date_input(
                "Date range:",
                key="compare_dates",
                value=(data_start_date, date.today()),
            )
            if len(compare_dates) > 1:
                compare_start_date, compare_end_date = compare_dates
        elif compare_date_range == "All dates":
            compare_start_date, compare_end_date = data_start_date, data_end_date
        elif compare_date_range == "Same days 1 month ago" and start_date is not None:
            compare_start_date = arrow.get(start_date).shift(months=-1).date()
            compare_end_date = arrow.get(end_date).shift(months=-1).date()
        elif compare_date_range == "Same days 1 year ago" and start_date is not None:
            compare_start_date = arrow.get(start_date).shift(years=-1).date()
            compare_end_date = arrow.get(end_date).shift(years=-1).date()
        else:
            compare_start_date, compare_end_date = dates.get_dates(compare_date_range)
    else:
        # Do not perform comparison if enable box is unchecked, so clear dates
        compare_start_date, compare_end_date = None, None

    # Table of contents
    if provider != "Select a Provider":
        config_ct.header("Sections")
        config_ct.markdown(
            "* [Summary](#summary)\n* [Outpatient](#outpatient)\n* [Inpatient](#inpatient)\n* [Source Data](#source-data)",
            unsafe_allow_html=True,
        )

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
