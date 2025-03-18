import pandas as pd
import plotly.express as px
import streamlit as st
from common import st_util, source_data_util
from ..model import source_data, settings, app_data


def show_settings(src_data: source_data.SourceData) -> dict:
    """
    Render the sidebar and return the dict with configuration options set by the user.
    """
    clinics = src_data.kvdata.get("clinics", [])

    col_1, col_2 = st.columns([1, 1])
    with col_1:
        clinic = st.selectbox(
            "Clinic:",
            options=["All Clinics"] + clinics + ["Unassigned"],
        )
    with col_2:
        providers_by_clinic = src_data.kvdata.get("providers", {})
        if clinic == "All Clinics":
            providers = source_data_util.dedup_ignore_case(
                [
                    provider
                    for clinic_providers in providers_by_clinic.values()
                    for provider in clinic_providers
                ]
            )
        else:
            providers = providers_by_clinic.get(clinic, [])

        provider = st.selectbox(
            "Paneled Provider:",
            options=["All Providers"] + providers,
        )

    return settings.Settings(clinic=clinic, provider=provider)


def st_patient_table(patients_df: pd.DataFrame):
    """
    Display patient table
    """
    patients_df = patients_df.copy()

    # Display a dataframe with selectable rows (one at a time) with only
    # columns prw_id, sex, age_display, city, state, panel_location
    # Display column headers Patient ID, Sex, Age, City, State, Panel
    selected_columns = [
        "prw_id",
        "sex",
        "age_display",
        "location",
        "panel_location",
        "panel_provider",
    ]
    display_columns = ["ID", "Sex", "Age", "City", "Panel", "Paneled Provider"]

    patients_df = patients_df[selected_columns]
    patients_df.columns = display_columns

    event = st.dataframe(
        patients_df.style.format(
            {
                "ID": "{}",
            }
        ),
        hide_index=True,
        use_container_width=True,
        selection_mode="single-row",
        on_select="rerun",
    )

    if event and event.selection and event.selection.rows:
        selected_row = event.selection.rows[0]
        selected_prwid = patients_df.iloc[selected_row]["ID"]
        return selected_prwid

    return None


def st_patient_stats(data: app_data.AppData):
    col_1, col_2, col_3 = st.columns([1, 1, 1])
    with col_1:
        title = "All Primary Care Patients"
        if data.provider != "All Providers":
            title = f"All Patients for {data.provider}"
        elif data.clinic != "All Clinics" and data.clinic != "Unassigned":
            title = f"All Patients at {data.clinic}"

        st_util.st_card(title, f"{data.n_total_selected_patients}", "Last 3 years")
    with col_2:
        title = "Paneled Patients"
        if data.provider != "All Providers":
            title = f"Paneled Patients for {data.provider}"
        elif data.clinic == "Unassigned":
            title = "Unpaneled Patients"
        elif data.clinic != "All Clinics":
            title = f"Paneled Patients at {data.clinic}"

        pct_paneled = data.n_paneled_patients / data.n_total_selected_patients * 100

        st_util.st_card(
            title, f"{data.n_paneled_patients}", f"{pct_paneled:.0f}% of total"
        )

    with col_3:
        st_util.st_card(
            "Encounters Last 12 Months",
            f"{data.n_encounters_last_12_months}",
            "All paneled and not paneled",
        )


def st_demographics(data: app_data.AppData):
    patients_df = data.paneled_patients_df

    col1, col2, col3 = st.columns([1, 1, 2])
    with col1:
        age_bins = [0, 1, 18, 65, float("inf")]
        age_labels = ["<1y", "<18y", "18-65y", ">65y"]
        patients_df["age_group"] = pd.cut(
            patients_df["age"], bins=age_bins, labels=age_labels, right=False
        )

        age_group_counts = patients_df["age_group"].value_counts().sort_index()

        fig = px.pie(
            age_group_counts,
            values=age_group_counts.values,
            names=age_group_counts.index,
            title="Age Groups",
            hole=0.5,
            color_discrete_sequence=px.colors.qualitative.Set2,
        )
        fig.update_layout(
            title={
                "text": "Age Groups",
                "x": 0.4,
                "xanchor": "center",
                "yanchor": "top",
                "font": {"size": 22, "weight": "normal"},
            },
            legend={
                "orientation": "h",
                "yanchor": "bottom",
                "y": -0.25,
                "xanchor": "center",
                "x": 0.5,
            },
        )

        # Place the chart inside a styleable container with card-like border
        with st_util.st_card_container("age_chart_container"):
            st.plotly_chart(fig, use_container_width=True)

    with col2:
        sex_counts = patients_df["sex"].value_counts()

        fig = px.pie(
            sex_counts,
            values=sex_counts.values,
            names=sex_counts.index,
            title="Sex",
            hole=0.5,
            color_discrete_sequence=px.colors.qualitative.Set1,
        )
        fig.update_layout(
            title={
                "text": "Sex",
                "x": 0.43,
                "xanchor": "center",
                "yanchor": "top",
                "font": {"size": 22, "weight": "normal"},
            },
            legend={
                "orientation": "h",
                "yanchor": "bottom",
                "y": -0.3,
                "xanchor": "center",
                "x": 0.5,
            },
        )
        with st_util.st_card_container("sex_chart_container"):
            st.plotly_chart(fig, use_container_width=True)

    with col3:
        location_counts = patients_df["location"].value_counts()
        location_counts["Other"] = location_counts[location_counts < 20].sum()
        location_counts = pd.concat(
            [
                location_counts[location_counts >= 20],
                pd.Series({"Other": location_counts["Other"]}),
            ]
        )

        fig = px.bar(
            location_counts,
            x=location_counts.index,
            y=location_counts.values,
            title="Locations",
            labels={"y": "", "index": ""},
        )
        fig.update_layout(
            title={
                "text": "Locations",
                "x": 0.5,
                "xanchor": "center",
                "yanchor": "top",
                "font": {"size": 22, "weight": "normal"},
            }
        )
        with st_util.st_card_container("location_chart_container"):
            st.plotly_chart(fig)


def st_new_patients(data: app_data.AppData):
    df = pd.DataFrame(
        {"Category": ["A", "B", "C", "D", "E"], "Values": [20, 14, 23, 25, 22]}
    )

    # Create bar chart
    fig = px.bar(
        df,
        x="Category",
        y="Values",
        title="Example Bar Chart",
        labels={"Values": "Count", "Category": "Group"},
    )

    fig.update_layout(
        title={
            "text": "",
            "x": 0.5,
            "xanchor": "center",
            "yanchor": "top",
            "font": {"size": 22, "weight": "normal"},
        }
    )

    with st_util.st_card_container("new_patients_chart_container"):
        st.plotly_chart(fig, use_container_width=True)


def st_encounter_table(encounters_df: pd.DataFrame, selected_prwid):
    if selected_prwid is None:
        return st.write("Select a patient to view encounters")

    encounters_df = encounters_df.copy()
    encounters_df = encounters_df[encounters_df["prw_id"] == selected_prwid]

    selected_columns = [
        "encounter_date",
        "service_provider",
        "diagnoses",
        "encounter_type",
        "level_of_service",
        "location",
    ]
    display_columns = [
        "Date",
        "Provider",
        "Diagnoses",
        "Type",
        "LOS",
        "Location",
    ]
    encounters_df = encounters_df[selected_columns]
    encounters_df.columns = display_columns

    # Keep only
    st.dataframe(
        encounters_df.style.format(
            {
                "Date": "{:%m/%d/%Y}",
            },
        ),
        hide_index=True,
    )
