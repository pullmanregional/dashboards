"""
Source data as in-memory copy of all DB tables as dataframes
"""

import logging
import json
import os
import pandas as pd
import streamlit as st
import requests
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from common import source_data_util

# Remote URL in Cloudflare R2
R2_ACCT_ID = st.secrets.get("PRH_FINANCE_R2_ACCT_ID")
R2_ACCT_KEY = st.secrets.get("PRH_FINANCE_R2_ACCT_KEY")
R2_URL = st.secrets.get("PRH_FINANCE_R2_URL")
R2_BUCKET = st.secrets.get("PRH_FINANCE_R2_BUCKET")

# Local data files
DATA_FILE = st.secrets.get("DATA_FILE")
DATA_JSON = st.secrets.get("DATA_JSON")

# Encryption key for remote database
DATA_KEY = st.secrets.get("DATA_KEY")


@dataclass(eq=True)
class SourceData:
    """In-memory copy of DB tables"""

    # Metadata
    last_updated: datetime = None

    # Tables
    volumes_df: pd.DataFrame = None
    uos_df: pd.DataFrame = None
    budget_df: pd.DataFrame = None
    hours_df: pd.DataFrame = None
    contracted_hours_df: pd.DataFrame = None
    income_stmt_df: pd.DataFrame = None

    contracted_hours_updated_month: str = None


def read() -> SourceData:
    if DATA_FILE:
        src_data = from_file(DATA_FILE, DATA_JSON)
    else:
        src_data = from_s3()

    return src_data


@st.cache_data(ttl=timedelta(minutes=2))
def from_file(file: str, json_file: str) -> SourceData:
    engine = source_data_util.sqlite_engine_from_file(file)
    src_data = from_db(engine)
    kvdata = source_data_util.json_from_file(json_file)
    src_data.contracted_hours_updated_month = kvdata.get(
        "contracted_hours_updated_month"
    )
    engine.dispose()
    return src_data


@st.cache_data(ttl=timedelta(hours=6), show_spinner="Loading...")
def from_s3() -> SourceData:
    r2_config = source_data_util.S3Config(R2_ACCT_ID, R2_ACCT_KEY, R2_URL)
    engine = source_data_util.sqlite_engine_from_s3(
        r2_config, R2_BUCKET, "prh-finance.sqlite3.enc", DATA_KEY
    )
    src_data = from_db(engine)
    engine.dispose()

    kvdata = source_data_util.json_from_s3(
        r2_config, R2_BUCKET, "prh-finance.json.enc", DATA_KEY
    )
    src_data.contracted_hours_updated_month = kvdata.get(
        "contracted_hours_updated_month"
    )
    source_data_util.cleanup()
    return src_data


def from_db(db_engine) -> SourceData:
    """
    Read all data from specified DB connection into memory and return as dataframes
    """
    logging.info("Reading DB tables")

    # Read metadata
    metadata = {
        "last_updated": pd.read_sql_query(
            "SELECT MAX(modified) FROM meta", db_engine
        ).iloc[0, 0],
    }

    # Create the SourceData object with all the dataframes
    return SourceData(
        last_updated=metadata["last_updated"],
        volumes_df=pd.read_sql_table("volumes", db_engine),
        uos_df=pd.read_sql_table("uos", db_engine),
        budget_df=pd.read_sql_table("budget", db_engine),
        hours_df=pd.read_sql_table("hours", db_engine),
        contracted_hours_df=pd.read_sql_table("contracted_hours", db_engine),
        income_stmt_df=pd.read_sql_table("income_stmt", db_engine),
    )
