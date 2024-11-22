import pandas as pd
from dataclasses import dataclass
from . import source_data

@dataclass(eq=True, frozen=True)
class AppDataBase():
    ai_prompt: str = None

@dataclass(eq=True, frozen=True)
class EncountersDataset(AppDataBase):
    """Patient and encounters data"""
    patients_df: pd.DataFrame = None
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
class AppData():
    encounters: EncountersDataset = None
    volumes: VolumesDataset = None
    finance: FinanceDataset = None


def transform(src_data: source_data.SourceData) -> AppData:
    encounters = None
    if src_data.encounters is not None:
        encounters = EncountersDataset(
            ai_prompt="When answering questions about age, if a patient's age at an encounter (encounter_age column) is < 2, then use encounter_age_mo, which is the age of the patient during that encounter in months. Same with patient age (age and age_mo columns).",
            patients_df=src_data.encounters.patients_df,
            encounters_df=src_data.encounters.encounters_df
        )

    volumes = None
    if src_data.volumes is not None:
        volumes_df = src_data.volumes.volumes_df
        uos_df =src_data.volumes.uos_df
        hours_df = src_data.volumes.hours_df
        contracted_hours_df = src_data.volumes.contracted_hours_df
        volumes = VolumesDataset(
            volumes_df=volumes_df,
            uos_df=uos_df, 
            hours_df=hours_df,
            contracted_hours_df=contracted_hours_df
        )

    # Transform finance data
    finance = None
    if src_data.finance is not None:
        budget_df = src_data.finance.budget_df
        income_stmt_df = src_data.finance.income_stmt_df 
        finance = FinanceDataset(
            budget_df=budget_df,
            income_stmt_df=income_stmt_df
        )

    return AppData(
        encounters=encounters,
        volumes=volumes,
        finance=finance
    )