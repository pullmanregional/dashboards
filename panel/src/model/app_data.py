"""
Transform source data into department specific data that can be displayed on dashboard
"""

import pandas as pd
import math
from dataclasses import dataclass
from datetime import date, datetime
from dateutil.relativedelta import relativedelta
from . import source_data, settings


@dataclass(frozen=True)
class AppData:
    # Settings
    clinic: str

    # Patients assigned to this clinic's panel
    paneled_patients_df: pd.DataFrame

    # All encounters
    encounters_df: pd.DataFrame


def process(settings: settings.Settings, src: source_data.SourceData) -> AppData:
    """
    Receives raw source data from database.
    Partitions and computes statistics to be displayed by the app.
    settings contains any configuration from the sidebar that the user selects.
    """
    clinic = settings.clinic

    # Filter patients by clinic
    if (clinic == "All Primary Care Clinics") or (clinic is None):
        paneled_patients_df = src.patients_df
    else:
        paneled_patients_df = src.patients_df[
            src.patients_df["panel_location"] == clinic
        ]

    return AppData(
        clinic=clinic,
        paneled_patients_df=paneled_patients_df,
        encounters_df=src.encounters_df,
    )
