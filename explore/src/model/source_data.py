"""
Source data as in-memory copy of all DB tables as dataframes
"""

import logging
import pandas as pd
import streamlit as st
from dataclasses import dataclass
from common import source_data_util

# Cloudflare R2 connection
R2_ACCT_ID = st.secrets.get("PRH_EXPLORE_R2_ACCT_ID")
R2_ACCT_KEY = st.secrets.get("PRH_EXPLORE_R2_ACCT_KEY")
R2_URL = st.secrets.get("PRH_EXPLORE_R2_URL")
R2_BUCKET = st.secrets.get("PRH_EXPLORE_R2_BUCKET")

# Encryption keys for datasets
PRH_DASH_DATA_KEY = st.secrets.get("PRH_DASH_DATA_KEY")
PRH_PANEL_DATA_KEY = st.secrets.get("PRH_PANEL_DATA_KEY")


@dataclass(eq=True, frozen=True)
class EncountersDataset:
    """Patient and encounters data"""

    jsondata: dict = None
    patients_df: pd.DataFrame = None
    encounters_df: pd.DataFrame = None


@dataclass(eq=True, frozen=True)
class VolumesDataset:
    """Volumes data"""

    jsondata: dict = None
    volumes_df: pd.DataFrame = None
    uos_df: pd.DataFrame = None
    hours_df: pd.DataFrame = None
    contracted_hours_df: pd.DataFrame = None


@dataclass(eq=True, frozen=True)
class FinanceDataset:
    """Financial data"""

    jsondata: dict = None
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
    logging.info("Fetching source data")
    r2_config = source_data_util.S3Config(R2_ACCT_ID, R2_ACCT_KEY, R2_URL)
    engine = source_data_util.sqlite_engine_from_s3(
        r2_config, R2_BUCKET, "panel.sqlite3.enc", PRH_PANEL_DATA_KEY
    )
    jsondata = source_data_util.json_from_s3(r2_config, R2_BUCKET, "panel.json")
    encounters = EncountersDataset(
        jsondata=jsondata,
        patients_df=pd.read_sql_table("patients", engine),
        encounters_df=pd.read_sql_table("encounters", engine),
    )
    engine.dispose()

    engine = source_data_util.sqlite_engine_from_s3(
        r2_config, R2_BUCKET, "prh-dash.db.sqlite3.enc", PRH_DASH_DATA_KEY
    )
    volumes = VolumesDataset(
        jsondata=jsondata,
        volumes_df=pd.read_sql_table("volumes", engine),
        uos_df=pd.read_sql_table("uos", engine),
        hours_df=pd.read_sql_table("hours", engine),
        contracted_hours_df=pd.read_sql_table("contracted_hours", engine),
    )
    finance = FinanceDataset(
        jsondata=jsondata,
        budget_df=pd.read_sql_table("budget", engine),
        income_stmt_df=pd.read_sql_table("income_stmt", engine),
    )
    engine.dispose()

    source_data_util.cleanup()
    return SourceData(encounters=encounters, volumes=volumes, finance=finance)
