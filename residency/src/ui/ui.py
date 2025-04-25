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
    st_section_header("Program Totals")
    st.write("**ACGME Metrics**")
    st_res_stats(stats["Overall"])
    st.write("#####")

    # Make a header for R1 through R3 if there are any residents in that year
    # Display sections for each residency year if there are residents
    for r_year in ["R3", "R2", "R1"]:
        if r_year in data.residents_by_year and len(data.residents_by_year[r_year]) > 0:
            st_section_header(f"{r_year} Residents")
            residents = data.residents_by_year[r_year]
            for resident in residents:
                st.write(f"##### {resident}")
                st.write("**ACGME Metrcis**")
                st_res_stats(stats[resident])
                st.write("#####")


def st_section_header(text):
    st.markdown(
        f"<h2 style='color:#207346; border-bottom: 2px solid #207346; margin-bottom: 1.5rem;'>{text}</h2>",
        unsafe_allow_html=True,
    )


def st_res_stats(stats):
    # Sort years in descending order, move Total to the end
    years = sorted(list(stats.keys()), reverse=True)
    years.remove("Total")
    years.append("Total")

    # Create table headers for all metrics
    headers = [
        "Academic Year",
        "Clinic",
        "ED",
        "Inpatient",
        "Pediatrics",
        "Geriatrics",
        "OB",
        "Provider Continuity",
        "Patient Continuity",
    ]

    # Create markdown table header
    table = " | ".join(headers) + "\n"
    table += "|".join(["---"] * len(headers)) + "\n"

    # Add row for each year / total
    for year in years:
        year_stats = stats[year]
        row = [
            "Total" if year == "Total" else str(year),
            str(year_stats.get("total_visits", "N/A")),
            str(year_stats.get("ed_encounters", "N/A")),
            str(year_stats.get("inpt_encounters", "N/A")),
            f"{year_stats.get('peds_percent', 'N/A')} - {year_stats.get('peds_comment', '')}",
            f"{year_stats.get('geriatrics_percent', 'N/A')} - {year_stats.get('geriatrics_comment', '')}",
            f"{year_stats.get('ob_percent', 'N/A')} - {year_stats.get('ob_comment', '')}",
            f"{year_stats.get('prov_continuity_percent', 'N/A')} - {year_stats.get('prov_continuity_comment', '')}",
            f"{year_stats.get('pt_continuity_percent', 'N/A')} - {year_stats.get('pt_continuity_comment', '')}",
        ]

        # Make the Total row bold
        if year == "Total":
            row[0] = f"**{row[0]}**"

        table += " | ".join(row) + "\n"
    st.markdown(table)
