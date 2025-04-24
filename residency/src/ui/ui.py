"""
Methods to show build streamlit UI
"""

import streamlit as st
from common.st_util import st_card
from ..model import source_data, app_data, settings


def show_settings(src_data: source_data.SourceData) -> settings.Settings:
    # Build left hand sidebar and return user chosen settings
    return settings.Settings()


def show_content(settings: settings.Settings, data: app_data.AppData):
    stats = data.stats

    # Program overall stats
    st.header("Program Totals", divider="blue")
    st_res_stats(stats["Overall"])
    st.write("#####")

    # Make a header for R1 through R3 if there are any residents in that year
    # Display sections for each residency year if there are residents
    for r_year in ["R3", "R2", "R1"]:
        if r_year in data.residents_by_year and len(data.residents_by_year[r_year]) > 0:
            st.header(f"{r_year} Residents", divider="blue")
            residents = data.residents_by_year[r_year]
            for resident in residents:
                st.write(f"##### {resident}")
                st_res_stats(stats[resident])
                st.write("#####")


def st_res_stats(stats):
    years = sorted(list(stats.keys()), reverse=True)
    years.remove("Total")

    # Create tabs for Total and each year
    tab_names = ["Overall"] + [str(year) for year in years]
    tabs = st.tabs(tab_names)

    # Display stats in each tab
    with tabs[0]:
        st_res_year_stats(stats["Total"])
    for idx, year in enumerate(years):
        with tabs[idx + 1]:
            st_res_year_stats(stats[year])


def st_res_year_stats(stats):
    # Cards in 3 columns
    col1, col2, col3 = st.columns(3)
    with col1:
        st_card(
            "Clinic Visits",
            str(stats.get("total_visits", "N/A")),
        )

    with col2:
        st_card(
            "ED Encounters",
            str(stats.get("ed_encounters", "N/A")),
        )

    with col3:
        st_card(
            "Inpatient Encounters",
            str(stats.get("inpt_encounters", "N/A")),
        )

    col1, col2, col3 = st.columns(3)
    with col1:
        st_card(
            "Pediatrics",
            stats.get("peds_percent", "N/A"),
            stats.get("peds_comment", ""),
        )

    with col2:
        st_card(
            "Geriatrics",
            stats.get("geriatrics_percent", "N/A"),
            stats.get("geriatrics_comment", ""),
        )

    with col3:
        st_card(
            "OB",
            stats.get("ob_percent", "N/A"),
            stats.get("ob_comment", ""),
        )

    # Row 2
    col1, col2, col3 = st.columns(3)
    with col1:
        st_card(
            "Patient Continuity",
            stats.get("pt_continuity_percent", "N/A"),
            stats.get("pt_continuity_comment", ""),
        )

    with col2:
        st_card(
            "Provider Continuity",
            stats.get("prov_continuity_percent", "N/A"),
            stats.get("prov_continuity_comment", ""),
        )
