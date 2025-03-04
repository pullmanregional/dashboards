import pandas as pd
from dataclasses import dataclass
from . import source_data, settings


@dataclass(eq=True, frozen=True)
class AppData:
    encounters_df: pd.DataFrame = None
    no_shows_df: pd.DataFrame = None
    patients_df: pd.DataFrame = None
    clinics: list[str] = None
    first_date: int = None
    last_date: int = None


CLINIC_DEPT_TO_NAME = {
    "CC WPL PALOUSE PEDIATRICS PULLMAN": "Palouse Pediatrics",
    "CC WPL PALOUSE PEDIATRICS MOSCOW": "Palouse Pediatrics",
    "CC WPL PULLMAN FAMILY MEDICINE": "Pullman Family Medicine",
    "CC WPL PALOUSE MED PRIMARY CARE": "Palouse Medical",
    "CC WPL FM RESIDENCY CLINIC": "Residency Clinic",
    "CC WPL PALOUSE HEALTH CTR PRIM CARE": "Pullman Family Medicine",
}


def process(src_data: source_data.SourceData, settings: settings.Settings) -> AppData:
    encounters_df = src_data.encounters_df
    no_shows_df = src_data.no_shows_df
    patients_df = src_data.patients_df

    # Translate dept to clinic name
    encounters_df["clinic"] = encounters_df["dept"].map(CLINIC_DEPT_TO_NAME)
    no_shows_df["clinic"] = no_shows_df["dept"].map(CLINIC_DEPT_TO_NAME)
    clinics = encounters_df["clinic"].unique().tolist()

    # Get the first and last dates in data
    first_date = encounters_df["encounter_date"].min()
    last_date = encounters_df["encounter_date"].max()

    # Transform source data into dashboard specific representation
    return AppData(
        encounters_df=encounters_df,
        no_shows_df=no_shows_df,
        patients_df=patients_df,
        clinics=clinics,
        first_date=first_date,
        last_date=last_date,
    )
