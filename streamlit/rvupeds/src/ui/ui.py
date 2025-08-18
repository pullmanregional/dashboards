"""
Methods to show build streamlit UI
"""

from datetime import date
import streamlit as st
import arrow
from ..model import source_data, app_data, settings
from . import dates, fig


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
        provider=provider,
        start_date=start_date,
        end_date=end_date,
        compare_start_date=compare_start_date,
        compare_end_date=compare_end_date,
    )


def show_content(
    settings: settings.Settings,
    data: app_data.AppData | None,
    compare: app_data.AppData | None,
):
    """Builds the main content"""
    if data is None:
        st.markdown(
            "<h5 style='color:#6e6e6e; padding-top:65px;'>Select a provider and date range</h5>",
            unsafe_allow_html=True,
        )
        return

    df, partitions, stats = data.df, data.partitions, data.stats
    cmp_df, cmp_partitions, cmp_stats = (
        (compare.df, compare.partitions, compare.stats)
        if compare is not None
        else (None, None, None)
    )

    # If no data is available, show message and stop
    if len(df.index) == 0:
        st.write("No data for selected time period.")
        return

    # Summary stats including overall # patients and wRVUs
    st.header("Summary")
    if compare is None:
        fig.st_summary(stats, data.start_date, data.end_date, st, columns=True)
    else:
        # Write metrics in side-by-side vertical columns
        colL, colR = st.columns(2)
        fig.st_summary(stats, data.start_date, data.end_date, colL, columns=False)
        fig.st_summary(
            cmp_stats, compare.start_date, compare.end_date, colR, columns=False
        )

    # Summary graphs
    st.markdown(
        '<p style="margin-top:0px; margin-bottom:-15px; text-align:center; color:#A9A9A9">RVU graphs do not include charges posted outside of dates, so totals may not match number above.</p>',
        unsafe_allow_html=True,
    )
    if compare is None:
        enc_ct, rvu_ct = st.columns(2)
        daily_ct = st.expander("By Day")
        daily_enc_ct, daily_rvu_ct = daily_ct.columns(2)
        fig.st_enc_by_month_fig(partitions, data.start_date, data.end_date, enc_ct)
        fig.st_rvu_by_month_fig(df, data.end_date, rvu_ct)
        fig.st_enc_by_day_fig(partitions, data.start_date, data.end_date, daily_enc_ct)
        fig.st_rvu_by_day_fig(df, data.start_date, data.end_date, daily_rvu_ct)
        daily_ct.markdown(
            '<p style="margin-top:-15px; margin-bottom:10px; text-align:center; color:#A9A9A9">To zoom in, click on a graph and drag horizontally</p>',
            unsafe_allow_html=True,
        )
    else:
        main_ct = st.container()
        main_colL, main_colR = main_ct.columns(2)
        daily_ct = st.expander("By Day")
        daily_colL, daily_colR = daily_ct.columns(2)
        fig.st_enc_by_month_fig(partitions, data.start_date, data.end_date, main_colL)
        fig.st_rvu_by_month_fig(df, data.end_date, main_colL)
        fig.st_enc_by_day_fig(partitions, data.start_date, data.end_date, daily_colL)
        fig.st_rvu_by_day_fig(df, data.start_date, data.end_date, daily_colL)

        fig.st_enc_by_month_fig(
            cmp_partitions, compare.start_date, compare.end_date, main_colR
        )
        fig.st_rvu_by_month_fig(cmp_df, compare.end_date, main_colR)
        fig.st_enc_by_day_fig(
            cmp_partitions, compare.start_date, compare.end_date, daily_colR
        )
        fig.st_rvu_by_day_fig(cmp_df, compare.start_date, compare.end_date, daily_colR)

        daily_ct.markdown(
            '<p style="margin-top:-15px; margin-bottom:10px; text-align:center; color:#A9A9A9">To zoom in, click on a graph and drag horizontally</p>',
            unsafe_allow_html=True,
        )

    # Outpatient Summary
    st.header("Outpatient")
    if compare is None:
        colL, colR = st.columns(2)
        fig.st_sick_visits_fig(stats, colL)
        fig.st_wcc_visits_fig(stats, colR)
        fig.st_sick_vs_well_fig(stats, colL)
        fig.st_non_encs_fig(partitions, colR)
    else:
        colL, colR = st.columns(2)
        fig.st_sick_visits_fig(stats, colL)
        fig.st_wcc_visits_fig(stats, colL)
        fig.st_sick_vs_well_fig(stats, colL)
        fig.st_non_encs_fig(partitions, colL)
        fig.st_sick_visits_fig(cmp_stats, colR)
        fig.st_wcc_visits_fig(cmp_stats, colR)
        fig.st_sick_vs_well_fig(cmp_stats, colR)
        fig.st_non_encs_fig(cmp_partitions, colR)

    # Inpatient Summary
    st.header("Inpatient")
    if compare is None:
        inpt_enc_ct = st.empty()
        colL, colR = st.columns(2)
        fig.st_inpt_encs_fig(partitions, inpt_enc_ct)
        fig.st_inpt_vs_outpt_encs_fig(stats, colL)
        fig.st_inpt_vs_outpt_rvu_fig(stats, colR)
    else:
        colL, colR = st.columns(2)
        fig.st_inpt_vs_outpt_encs_fig(stats, colL)
        fig.st_inpt_vs_outpt_rvu_fig(stats, colL)
        fig.st_inpt_vs_outpt_encs_fig(cmp_stats, colR)
        fig.st_inpt_vs_outpt_rvu_fig(cmp_stats, colR)

    # Source data
    st.header("Source Data")
    dataset_ct = st.empty()
    render_dataset(data, dataset_ct)


def render_dataset(data: app_data.AppData, dataset_ct):
    """Show the named source dataset in the provided container"""
    if data is None:
        return

    df, partitions = data.df, data.partitions
    display_dfs = {
        "None": None,
        "All Data (including shots, etc)": df,
        "All Visits (Inpatient + Outpatient)": partitions["all_encs"],
        "Inpatient - All": partitions["inpt_all"],
        "Outpatient - All": partitions["outpt_all"],
        "Outpatient - Visits": partitions["outpt_encs"],
        "Outpatient - Well Only": partitions["wcc_encs"],
        "Outpatient - Sick Only": partitions["sick_encs"],
        "Outpatient - Other Charges": partitions["outpt_not_encs"],
    }
    dataset_name = st.selectbox("Show Data Set:", display_dfs.keys())
    display_df = display_dfs.get(dataset_name)

    # Filters for other partitions not used elsewhere
    if dataset_name == "Clinic - 99211 and 99212":
        display_df = df[df.cpt.str.match("992[01][12]")]
    elif dataset_name == "Clinic - 99213":
        display_df = df[df.cpt.str.match("992[01]3")]
    elif dataset_name == "Clinic - 99214 and above":
        display_df = df[df.cpt.str.match("992[01][45]|9949[56]")]

    if display_df is not None:
        st.dataframe(display_df)
        st.write(f"{len(display_df)} rows")
