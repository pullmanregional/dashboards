import pandas as pd
import pandasai as pai
from dataclasses import dataclass
from . import source_data


@dataclass(eq=True, frozen=True)
class AppDataBase:
    ai_prompt: str = None


@dataclass(eq=True, frozen=True)
class EncountersDataset(AppDataBase):
    """Patient and encounters data"""

    patients_dataset: pai.DataFrame = None
    encounters_dataset: pai.DataFrame = None

@dataclass(eq=True, frozen=True)
class VolumesDataset(AppDataBase):
    """Volumes data"""

    volumes_dataset: pai.DataFrame = None
    uos_dataset: pai.DataFrame = None
    hours_dataset: pai.DataFrame = None
    contracted_hours_dataset: pai.DataFrame = None


@dataclass(eq=True, frozen=True)
class FinanceDataset(AppDataBase):
    """Financial data"""

    budget_dataset: pai.DataFrame = None
    income_stmt_dataset: pai.DataFrame = None


@dataclass(eq=True, frozen=True)
class AppData:
    encounters: EncountersDataset = None
    volumes: VolumesDataset = None
    finance: FinanceDataset = None


def process(src_data: source_data.SourceData) -> AppData:
    encounters = None
    if src_data.encounters is not None:
        # Get source data metadata
        patients_df_desc = src_data.encounters.jsondata.get("patientsFieldDescriptions")
        encounters_df_desc = src_data.encounters.jsondata.get("encountersFieldDescriptions")

        # Create pandasai dataframes from source data and metadata
        patients_dataset = pai.DataFrame(src_data.encounters.patients_df)
        encounters_dataset = pai.DataFrame(src_data.encounters.encounters_df)

        encounters = EncountersDataset(
            ai_prompt=src_data.encounters.jsondata.get("aiPrompt"),
            patients_dataset=patients_dataset,
            encounters_dataset=encounters_dataset,
        )

    volumes = None
    if src_data.volumes is not None:
        # Get source data metadata
        volumes_df_desc = src_data.volumes.jsondata.get("volumesFieldDescriptions")
        uos_df_desc = src_data.volumes.jsondata.get("uosFieldDescriptions")
        hours_df_desc = src_data.volumes.jsondata.get("hoursFieldDescriptions")
        contracted_hours_df_desc = src_data.volumes.jsondata.get("contractedHoursFieldDescriptions")

        # Create pandasai dataframes from source data and metadata
        volumes_dataset = pai.DataFrame(src_data.volumes.volumes_df)
        uos_dataset = pai.DataFrame(src_data.volumes.uos_df)
        hours_dataset = pai.DataFrame(src_data.volumes.hours_df)
        contracted_hours_dataset = pai.DataFrame(src_data.volumes.contracted_hours_df)

        volumes = VolumesDataset(
            ai_prompt=src_data.volumes.jsondata.get("aiPrompt"),
            volumes_dataset=volumes_dataset,
            uos_dataset=uos_dataset,
            hours_dataset=hours_dataset,
            contracted_hours_dataset=contracted_hours_dataset,
        )

    # Transform finance data
    finance = None
    if src_data.finance is not None:
        # Get source data metadata
        budget_df_desc = src_data.finance.jsondata.get("budgetFieldDescriptions")
        income_stmt_df_desc = src_data.finance.jsondata.get("incomeStmtFieldDescriptions")

        # Create pandasai dataframes from source data and metadata
        budget_dataset = pai.DataFrame(src_data.finance.budget_df.drop(columns=["id"]))
        income_stmt_dataset = pai.DataFrame(src_data.finance.income_stmt_df.drop(columns=["id"]))

        finance = FinanceDataset(
            ai_prompt=src_data.finance.jsondata.get("aiPrompt"),
            budget_dataset=budget_dataset,
            income_stmt_dataset=income_stmt_dataset,
        )

    return AppData(encounters=encounters, volumes=volumes, finance=finance)
