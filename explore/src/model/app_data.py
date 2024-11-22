import pandas as pd
from dataclasses import dataclass
from . import source_data
from pandasai.connectors import PandasConnector


@dataclass(eq=True, frozen=True)
class AppDataBase:
    ai_prompt: str = None


@dataclass(eq=True, frozen=True)
class EncountersDataset(AppDataBase):
    """Patient and encounters data"""

    patients_df: PandasConnector = None
    encounters_df: pd.DataFrame = None


@dataclass(eq=True, frozen=True)
class VolumesDataset(AppDataBase):
    """Volumes data"""

    volumes_df: pd.DataFrame = None
    uos_df: pd.DataFrame = None
    hours_df: pd.DataFrame = None
    contracted_hours_df: pd.DataFrame = None


@dataclass(eq=True, frozen=True)
class FinanceDataset(AppDataBase):
    """Financial data"""

    budget_df: pd.DataFrame = None
    income_stmt_df: pd.DataFrame = None


@dataclass(eq=True, frozen=True)
class AppData:
    encounters: EncountersDataset = None
    volumes: VolumesDataset = None
    finance: FinanceDataset = None


def transform(src_data: source_data.SourceData) -> AppData:
    encounters = None
    if src_data.encounters is not None:
        # Create PandasConnector with field descriptions
        patients_connector = PandasConnector(
            {"original_df": src_data.encounters.patients_df},
            field_descriptions={
                "prw_id": "Unique patient identifier, used as a key for all patient data including encounters",
                "sex": "Patient's biological sex",
                "age": "Integer age in years",
                "age_mo": "Integer age in months if age column is less than 2 years",
                "age_display": "Formatted display combining age and age_mo appropriately",
                "location": "Patient's city and state of residence",
                "pcp": "Assigned primary care provider",
                "panel_location": "Office name where patient receives care",
                "panel_provider": "Actual primary care provider seen by patient, which may differ from assigned pcp",
            },
        )

        # Create PandasConnector for encounters data
        encounters_connector = PandasConnector(
            {"original_df": src_data.encounters.encounters_df},
            field_descriptions={
                "prw_id": "Foreign key linking to patient record",
                "location": "Unique office name where encounter took place",
                "encounter_date": "Date when the encounter occurred, does not include time of day",
                "encounter_age": "Patient's integer age in years at time of encounter",
                "encounter_age_mo": "Patient's integer age in months at time of encounter if encounter_age column is less than 2 years",
                "encounter_type": "Unique string identifying the type of encounter, such as Well visit, acute, etc.",
                "service_provider": "Person who conducted the encounter",
                "with_pcp": "0 or 1 indicating if encounter was with patient's primary care provider",
                "diagnoses": "Semicolon separated list of diagnoses with their ICD codes associated with the encounter",
                "level_of_service": "Complexity level of the encounter assigned by the provider, such as 1, 2, 3, 4, or 5",
            },
        )

        encounters = EncountersDataset(
            ai_prompt="Palouse Pediatrics, or just Pediatrics, includes both encounter locations Palouse Pediatrics Pullman and Palouse Pediatrics Moscow. Well visits are encounter_type=Well.",
            patients_df=patients_connector,
            encounters_df=encounters_connector,
        )

    volumes = None
    if src_data.volumes is not None:
        volumes_df = src_data.volumes.volumes_df
        uos_df = src_data.volumes.uos_df
        hours_df = src_data.volumes.hours_df
        contracted_hours_df = src_data.volumes.contracted_hours_df
        volumes = VolumesDataset(
            volumes_df=volumes_df,
            uos_df=uos_df,
            hours_df=hours_df,
            contracted_hours_df=contracted_hours_df,
        )

    # Transform finance data
    finance = None
    if src_data.finance is not None:
        budget_df = src_data.finance.budget_df.drop(columns=["id"])
        income_stmt_df = src_data.finance.income_stmt_df.drop(columns=["id"])
        finance = FinanceDataset(budget_df=budget_df, income_stmt_df=income_stmt_df)

    return AppData(encounters=encounters, volumes=volumes, finance=finance)
