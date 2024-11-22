"""
Source data as in-memory copy of all DB tables as dataframes
"""

import logging
import pandas as pd
import streamlit as st
from dataclasses import dataclass
from . import datasources

# Encryption key for datamarts
PRH_DASH_DATA_KEY = st.secrets.get("PRH_DASH_DATA_KEY")
PRH_PANEL_DATA_KEY = st.secrets.get("PRH_PANEL_DATA_KEY")


@dataclass(eq=True, frozen=True)
class EncountersDataset():
    """Patient and encounters data"""

    patients_df: pd.DataFrame = None
    encounters_df: pd.DataFrame = None


@dataclass(eq=True, frozen=True)
class VolumesDataset():
    """Volumes data"""

    volumes_df: pd.DataFrame = None
    uos_df: pd.DataFrame = None
    hours_df: pd.DataFrame = None
    contracted_hours_df: pd.DataFrame = None


@dataclass(eq=True, frozen=True)
class FinanceDataset():
    """Financial data"""

    budget_df: pd.DataFrame = None
    income_stmt_df: pd.DataFrame = None


@dataclass(eq=True, frozen=True)
class SourceData:
    """In-memory copy of DB tables"""

    encounters: EncountersDataset = None
    volumes: VolumesDataset = None
    finance: FinanceDataset = None


@st.cache_data
def from_s3() -> SourceData:
    logging.info("Reading DB tables")
    engine = datasources.connect_s3(obj="panel.sqlite3.enc", data_key=PRH_PANEL_DATA_KEY)
    encounters = EncountersDataset(
        patients_df=pd.read_sql_table("patients", engine),
        encounters_df=pd.read_sql_table("encounters", engine),
    )
    engine.dispose()

    engine = datasources.connect_s3(obj="prh-dash.db.sqlite3.enc", data_key=PRH_DASH_DATA_KEY)
    volumes = VolumesDataset(
        volumes_df=pd.read_sql_table("volumes", engine),
        uos_df=pd.read_sql_table("uos", engine),
        hours_df=pd.read_sql_table("hours", engine),
        contracted_hours_df=pd.read_sql_table("contracted_hours", engine),
    )
    finance = FinanceDataset(
        budget_df=pd.read_sql_table("budget", engine),
        income_stmt_df=pd.read_sql_table("income_stmt", engine),
    )
    engine.dispose()

    datasources.cleanup()
    return SourceData(encounters=encounters, volumes=volumes, finance=finance)
