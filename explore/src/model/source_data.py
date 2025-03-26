"""
Source data as in-memory copy of all DB tables as dataframes
"""

import logging
import pandas as pd
import streamlit as st
from dataclasses import dataclass
from datetime import datetime, timedelta
from common import source_data_util

# Cloudflare R2 connection
R2_ACCT_ID = st.secrets.get("PRH_EXPLORE_R2_ACCT_ID")
R2_ACCT_KEY = st.secrets.get("PRH_EXPLORE_R2_ACCT_KEY")
R2_URL = st.secrets.get("PRH_EXPLORE_R2_URL")
R2_BUCKET = st.secrets.get("PRH_EXPLORE_R2_BUCKET")

# Local data files
PRH_FINANCE_DATA_FILE = st.secrets.get("PRH_FINANCE_DATA_FILE")
PRH_FINANCE_DATA_JSON = st.secrets.get("PRH_FINANCE_DATA_JSON")
PRH_PANEL_DATA_FILE = st.secrets.get("PRH_PANEL_DATA_FILE")
PRH_PANEL_DATA_JSON = st.secrets.get("PRH_PANEL_DATA_JSON")

# Encryption keys for datasets
PRH_FINANCE_DATA_KEY = st.secrets.get("PRH_FINANCE_DATA_KEY")
PRH_PANEL_DATA_KEY = st.secrets.get("PRH_PANEL_DATA_KEY")


@dataclass(eq=True)
class EncountersDataset:
    """Patient and encounters data"""

    jsondata: dict = None
    patients_df: pd.DataFrame = None
    encounters_df: pd.DataFrame = None


@dataclass(eq=True)
class VolumesDataset:
    """Volumes data"""

    jsondata: dict = None
    volumes_df: pd.DataFrame = None
    uos_df: pd.DataFrame = None
    hours_df: pd.DataFrame = None
    contracted_hours_df: pd.DataFrame = None


@dataclass(eq=True)
class FinanceDataset:
    """Financial data"""

    jsondata: dict = None
    budget_df: pd.DataFrame = None
    income_stmt_df: pd.DataFrame = None


@dataclass(eq=True)
class SourceData:
    """In-memory copy of DB tables"""

    encounters: EncountersDataset = None
    volumes: VolumesDataset = None
    finance: FinanceDataset = None

    panel_kvdata: dict = None
    finance_kvdata: dict = None


def read() -> SourceData:
    if PRH_FINANCE_DATA_FILE and PRH_FINANCE_DATA_JSON:
        src_data = from_files(
            PRH_FINANCE_DATA_FILE,
            PRH_FINANCE_DATA_JSON,
            PRH_PANEL_DATA_FILE,
            PRH_PANEL_DATA_JSON,
        )
    else:
        src_data = from_s3()

    return src_data


@st.cache_data(ttl=timedelta(minutes=2))
def from_files(
    finance_file: str, finance_json: str, panel_file: str, panel_json: str
) -> SourceData:
    panel_engine = source_data_util.sqlite_engine_from_file(panel_file)
    finance_engine = source_data_util.sqlite_engine_from_file(finance_file)
    src_data = from_dbs(panel_engine, finance_engine)
    src_data.panel_kvdata = source_data_util.json_from_file(panel_json)
    src_data.finance_kvdata = source_data_util.json_from_file(finance_json)
    finance_engine.dispose()
    panel_engine.dispose()
    return src_data


@st.cache_data(ttl=timedelta(hours=6), show_spinner="Loading...")
def from_s3() -> SourceData:
    logging.info("Fetching source data")
    r2_config = source_data_util.S3Config(R2_ACCT_ID, R2_ACCT_KEY, R2_URL)
    panel_engine = source_data_util.sqlite_engine_from_s3(
        r2_config, R2_BUCKET, "prh-panel.sqlite3.enc", PRH_PANEL_DATA_KEY
    )
    finance_engine = source_data_util.sqlite_engine_from_s3(
        r2_config, R2_BUCKET, "prh-finance.sqlite3.enc", PRH_FINANCE_DATA_KEY
    )

    src_data = from_dbs(panel_engine, finance_engine)
    src_data.panel_kvdata = source_data_util.json_from_s3(
        r2_config, R2_BUCKET, "prh-panel.json.enc", PRH_PANEL_DATA_KEY
    )
    src_data.finance_kvdata = source_data_util.json_from_s3(
        r2_config, R2_BUCKET, "prh-finance.json.enc", PRH_FINANCE_DATA_KEY
    )

    panel_engine.dispose()
    finance_engine.dispose()

    source_data_util.cleanup()
    return src_data


def from_dbs(panel_engine, finance_engine) -> SourceData:
    # Use read_sql_query instead of read_sql_table to handle date format issues
    encounters_df = pd.read_sql_query("SELECT * FROM encounters", panel_engine)
    encounters_df["encounter_date"] = pd.to_datetime(
        encounters_df["encounter_date"]
    ).dt.date
    encounters = EncountersDataset(
        patients_df=pd.read_sql_table("patients", panel_engine),
        encounters_df=encounters_df,
    )
    volumes = VolumesDataset(
        volumes_df=pd.read_sql_table("volumes", finance_engine),
        uos_df=pd.read_sql_table("uos", finance_engine),
        hours_df=pd.read_sql_table("hours", finance_engine),
        contracted_hours_df=pd.read_sql_table("contracted_hours", finance_engine),
    )
    finance = FinanceDataset(
        budget_df=pd.read_sql_table("budget", finance_engine),
        income_stmt_df=pd.read_sql_table("income_stmt", finance_engine),
    )

    return SourceData(encounters=encounters, volumes=volumes, finance=finance)
