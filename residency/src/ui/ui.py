"""
Methods to show build streamlit UI
"""

import streamlit as st
import plotly.express as px
from common.st_util import st_card
from ..model import source_data, app_data, settings
import pandas as pd


def show_settings(src_data: source_data.SourceData) -> settings.Settings:
    # Build left hand sidebar and return user chosen settings
    return settings.Settings()


def show_content(settings: settings.Settings, data: app_data.AppData):
    stats = data.stats

    # Program overall stats
    st_section_header("Program Totals")
    st_volume_graph(data, "")
    st.write("**ACGME Metrics**")
    st_acgme_stats(stats["Overall"])
    st.write("#####")

    # Make a header for R1 through R3 if there are any residents in that year
    # Display sections for each residency year if there are residents
    for r_year in ["R3", "R2", "R1"]:
        if r_year in data.residents_by_year and len(data.residents_by_year[r_year]) > 0:
            st_section_header(f"{r_year} Residents")
            residents = data.residents_by_year[r_year]
            for resident in residents:
                st.write(f"##### {resident}")
                st_resident_stats(stats[resident])
                st_volume_graph(data, resident)

                st.write(f"**ACGME Metrics ({resident})**")
                st_acgme_stats(stats[resident])

                with st.expander("View Encounters and Notes"):
                    st_data_tables(data.resident_dfs[resident])

                st.write("#####")


def st_section_header(text):
    st.markdown(
        f"<h2 style='color:#207346; border-bottom: 2px solid #207346; margin-bottom: 1.5rem;'>{text}</h2>",
        unsafe_allow_html=True,
    )


def st_resident_stats(stats):
    col1, col2, col3 = st.columns(3)
    with col1:
        st_card(
            title="Panel Size",
            content=f"{stats['Total']['num_paneled_patients']}",
            description="Patients with this assigned PCP in Epic",
        )
    with col2:
        pass


def st_volume_graph(data: app_data.AppData, resident: str):
    if resident == "":
        return

    df = data.resident_dfs[resident].num_encounters_by_date_and_type

    # Calculate initial date range for last 6 months
    latest_date = df["Date"].max()
    six_months_ago = latest_date - pd.DateOffset(months=4)

    fig = px.bar(
        df,
        x=df["Date"],
        y=["Clinic", "Inpatient", "ED"],
        labels={"value": "Encounters", "variable": "Type"},
        hover_data=None,
    )

    fig.update_layout(
        xaxis=dict(
            title="Date",
            type="date",
            tickformat="%a %Y-%m-%d",
            dtick="M1",
            range=[six_months_ago, latest_date],
            rangeslider=dict(visible=True, thickness=0.05),
        ),
        yaxis_title="Encounters",
        margin=dict(b=40),
        hovermode="x unified",
        showlegend=True,
    )

    # Simple hover showing just the count
    fig.update_traces(hovertemplate="%{y}")

    st.plotly_chart(fig, use_container_width=True)


def st_acgme_stats(stats):
    # Sort years in descending order, move Total to the end
    years = sorted(list(stats.keys()), reverse=True)
    years.remove("Total")
    years.append("Total")

    # Create table headers for all metrics
    headers = [
        "Year",
        "Clinic",
        "ED Adult",
        "ED Peds",
        "Inpatient Adult",
        "Inpatient Peds",
        "Clinic Peds",
        "Clinic Geriatrics",
        "Clinic OB",
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
            str(year_stats.get("ed_adult_encounters", "N/A")),
            str(year_stats.get("ed_peds_encounters", "N/A")),
            str(year_stats.get("inpt_adult_encounters", "N/A")),
            str(year_stats.get("inpt_peds_encounters", "N/A")),
            f"{year_stats.get('peds_percent', 'N/A')} - :small[*{year_stats.get('peds_comment', '')}*]",
            f"{year_stats.get('geriatrics_percent', 'N/A')} - :small[*{year_stats.get('geriatrics_comment', '')}*]",
            f"{year_stats.get('ob_percent', 'N/A')} - :small[*{year_stats.get('ob_comment', '')}*]",
            f"{year_stats.get('prov_continuity_percent', 'N/A')} - :small[*{year_stats.get('prov_continuity_comment', '')}*]",
            f"{year_stats.get('pt_continuity_percent', 'N/A')} - :small[*{year_stats.get('pt_continuity_comment', '')}*]",
        ]

        # Make the Total row bold
        if year == "Total":
            row[0] = f"**{row[0]}**"

        table += " | ".join(row) + "\n"

    st.markdown(table, unsafe_allow_html=True)


def st_data_tables(data: app_data.ResidentData):
    tabs = st.tabs(["Clinic", "ED", "Inpatient"])
    tabs[0].dataframe(
        data.encounters_df[
            [
                "prw_id",
                "dept",
                "academic_year",
                "encounter_date",
                "encounter_age",
                "encounter_type",
                "service_provider",
                "with_pcp",
                "level_of_service",
                "diagnoses",
            ]
        ].rename(
            columns={
                "prw_id": "Anonymized ID",
                "dept": "Department",
                "academic_year": "Year",
                "encounter_date": "Date",
                "encounter_age": "Age",
                "encounter_type": "Type",
                "service_provider": "Provider",
                "with_pcp": "With PCP?",
                "diagnoses": "Diagnoses",
                "level_of_service": "LOS",
            }
        ),
        hide_index=True,
        column_config={
            "Date": st.column_config.DateColumn(
                "Date",
                format="YYYY-MM-DD",
            ),
        },
    )

    # Common columns and configuration for both ED and inpatient notes
    note_columns = [
        "prw_id",
        "academic_year",
        "service_date",
        "peds",
        "encounter_age",
        "dept",
        "service",
        "note_type",
        "initial_author",
        "signing_author",
        "cosign_author",
        "diagnosis",
    ]

    note_column_rename = {
        "prw_id": "Anonymized ID",
        "academic_year": "Year",
        "service_date": "Date",
        "encounter_age": "Age",
        "peds": "Peds?",
        "dept": "Department",
        "service": "Service",
        "note_type": "Note Type",
        "initial_author": "Initial Author",
        "signing_author": "Signing Author",
        "cosign_author": "Cosigner",
        "diagnosis": "Diagnosis",
    }

    note_column_config = {
        "Date": st.column_config.DateColumn(
            "Date",
            format="YYYY-MM-DD",
        ),
    }

    # ED Notes tab
    tabs[1].dataframe(
        data.notes_ed_df[note_columns].rename(columns=note_column_rename),
        hide_index=True,
        column_config=note_column_config,
    )

    # Inpatient Notes tab
    tabs[2].dataframe(
        data.notes_inpt_df[note_columns].rename(columns=note_column_rename),
        hide_index=True,
        column_config=note_column_config,
    )
