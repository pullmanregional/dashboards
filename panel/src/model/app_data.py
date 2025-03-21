"""
Transform source data into department specific data that can be displayed on dashboard
"""

import pandas as pd
from dataclasses import dataclass
from datetime import datetime, timedelta
import numpy as np
from . import source_data, settings


@dataclass(frozen=True)
class AppData:
    # Settings
    clinic: str
    provider: str

    # Patients assigned to this clinic's panel
    paneled_patients_df: pd.DataFrame

    # Patients seen in clinic but not paneled to that clinic
    unpaneled_patients_df: pd.DataFrame

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

    # Calculate average encounters per year for each patient
    # Get first encounter date for each patient
    first_encounters = (
        encounters_df.groupby("prw_id")["encounter_date"].min().reset_index()
    )
    first_encounters.rename(
        columns={"encounter_date": "first_encounter_date"}, inplace=True
    )

    # Get count of encounters for each patient
    encounter_counts = (
        encounters_df.groupby("prw_id").size().reset_index(name="encounter_count")
    )

    # Merge the first encounter date and counts with patients_df
    patients_df = patients_df.merge(first_encounters, on="prw_id", how="left")
    patients_df = patients_df.merge(encounter_counts, on="prw_id", how="left")

    # Calculate years since first encounter (or set to NaN if no encounters)
    current_date = datetime.now()
    patients_df["years_as_patient"] = (
        current_date - patients_df["first_encounter_date"]
    ).dt.days / 365.25

    # Calculate average encounters per year
    # For patients with less than 1 year history, use actual encounter count
    # otherwise divide by years_as_patient
    patients_df["avg_encounters_per_year"] = np.where(
        patients_df["years_as_patient"] >= 1,
        patients_df["encounter_count"] / patients_df["years_as_patient"],
        patients_df["encounter_count"],
    )

    # Handle NaN values (patients with no encounters)
    patients_df["avg_encounters_per_year"] = patients_df[
        "avg_encounters_per_year"
    ].fillna(0)

    # Round to 1 decimal place
    patients_df["avg_encounters_per_year"] = patients_df[
        "avg_encounters_per_year"
    ].round(1)

    # Filter patients/encounters by clinic
    if clinic == "All Clinics":
        paneled_patients_df = patients_df[~patients_df["panel_location"].isna()]
        # Unpaneled patients with any encounter
        unpaneled_patients_df = patients_df[
            patients_df["panel_location"].isna()
            & patients_df["prw_id"].isin(encounters_df["prw_id"])
        ]
    elif clinic == "Unassigned":
        paneled_patients_df = patients_df[patients_df["panel_location"].isna()]
        unpaneled_patients_df = pd.DataFrame(columns=patients_df.columns)
    else:
        # Filter encounters for this clinic
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

        # Patients paneled to this clinic
        paneled_patients_df = patients_df[patients_df["panel_location"] == clinic]

        # Patients seen in this clinic but paneled elsewhere or not paneled
        unpaneled_patients_df = patients_df[
            (
                (patients_df["panel_location"] != clinic)
                | patients_df["panel_location"].isna()
            )
            & patients_df["prw_id"].isin(encounters_df["prw_id"])
        ]

    # Filter patients/encounters by provider
    if provider != "All Providers":
        encounters_df = encounters_df[encounters_df["service_provider"] == provider]
        patients_df = patients_df[patients_df["prw_id"].isin(encounters_df["prw_id"])]
        paneled_patients_df = paneled_patients_df[
            paneled_patients_df["panel_provider"] == provider
        ]
        unpaneled_patients_df = unpaneled_patients_df[
            unpaneled_patients_df["prw_id"].isin(encounters_df["prw_id"])
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
        unpaneled_patients_df=unpaneled_patients_df,
        encounters_df=src.encounters_df,
        new_visits_by_month=src.new_visits_by_month,
        n_total_selected_patients=n_total_selected_patients,
        n_paneled_patients=n_paneled_patients,
        n_encounters_last_12_months=n_encounters_last_12_months,
    )
