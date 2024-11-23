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


def process(src_data: source_data.SourceData) -> AppData:
    encounters = None
    if src_data.encounters is not None:
        # Create PandasConnector with field descriptions
        patients_connector = PandasConnector(
            {"original_df": src_data.encounters.patients_df},
            field_descriptions=src_data.encounters.jsondata.get(
                "patientsFieldDescriptions"
            ),
        )

        # Create PandasConnector for encounters data
        encounters_connector = PandasConnector(
            {"original_df": src_data.encounters.encounters_df},
            field_descriptions=src_data.encounters.jsondata.get(
                "encountersFieldDescriptions"
            ),
        )

        encounters = EncountersDataset(
            ai_prompt=src_data.encounters.jsondata.get("aiPrompt"),
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
