"""
Transform source data into department specific data that can be displayed on dashboard
"""

import pandas as pd
from dataclasses import dataclass
from datetime import datetime, timedelta
from . import source_data, settings


@dataclass(frozen=True)
class AppData:
    # Settings
    clinic: str
    provider: str

    # Patients assigned to this clinic's panel
    paneled_patients_df: pd.DataFrame

    # All encounters
    encounters_df: pd.DataFrame

    # New patients
    new_visits_by_month: pd.DataFrame

    # Stats
    n_total_selected_patients: int = 0
    n_paneled_patients: int = 0
    n_encounters_last_12_months: int = 0


def process(settings: settings.Settings, src: source_data.SourceData) -> AppData:
    """
    Receives raw source data from database.
    Partitions and computes statistics to be displayed by the app.
    settings contains any configuration from the sidebar that the user selects.
    """
    clinic = settings.clinic
    provider = settings.provider
    patients_df = src.patients_df
    encounters_df = src.encounters_df

    # Filter patients/encounters by clinic
    if clinic == "All Clinics":
        paneled_patients_df = patients_df[~patients_df["panel_location"].isna()]
    elif clinic == "Unassigned":
        paneled_patients_df = patients_df[patients_df["panel_location"].isna()]
    else:
        paneled_patients_df = patients_df[patients_df["panel_location"] == clinic]
        if clinic == "Palouse Pediatrics":
            encounters_df = encounters_df[
                (encounters_df["location"] == "Palouse Pediatrics Pullman")
                | (encounters_df["location"] == "Palouse Pediatrics Moscow")
            ]
        elif clinic == "Pullman Family Medicine":
            encounters_df = encounters_df[
                (encounters_df["location"] == "Pullman Family Medicine")
                | (
                    encounters_df["location"]
                    == "Pullman Family Medicine (Palouse Health Center)"
                )
            ]
        else:
            encounters_df = encounters_df[encounters_df["location"] == clinic]
        patients_df = patients_df[patients_df["prw_id"].isin(encounters_df["prw_id"])]

    x = paneled_patients_df[~paneled_patients_df["prw_id"].isin(patients_df["prw_id"])]
    y = patients_df[~patients_df["prw_id"].isin(paneled_patients_df["prw_id"])]

    # Filter patients/encounters by provider
    if provider != "All Providers":
        encounters_df = encounters_df[encounters_df["service_provider"] == provider]
        patients_df = patients_df[patients_df["prw_id"].isin(encounters_df["prw_id"])]
        paneled_patients_df = paneled_patients_df[
            paneled_patients_df["panel_provider"] == provider
        ]

    # Calculate stats
    n_total_selected_patients = patients_df.shape[0]
    n_paneled_patients = paneled_patients_df.shape[0]
    n_encounters_last_12_months = encounters_df[
        encounters_df["encounter_date"] >= (datetime.now() - timedelta(days=365))
    ].shape[0]

    return AppData(
        clinic=clinic,
        provider=provider,
        paneled_patients_df=paneled_patients_df,
        encounters_df=src.encounters_df,
        new_visits_by_month=src.new_visits_by_month,
        n_total_selected_patients=n_total_selected_patients,
        n_paneled_patients=n_paneled_patients,
        n_encounters_last_12_months=n_encounters_last_12_months,
    )
