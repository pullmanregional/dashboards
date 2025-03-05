"""
Source data as in-memory copy of all DB tables as dataframes
"""

import logging
import pandas as pd
import streamlit as st
from dataclasses import dataclass
from common import source_data_util

# Cloudflare R2 connection
R2_ACCT_ID = st.secrets.get("PRH_MARKETING_R2_ACCT_ID")
R2_ACCT_KEY = st.secrets.get("PRH_MARKETING_R2_ACCT_KEY")
R2_URL = st.secrets.get("PRH_MARKETING_R2_URL")
R2_BUCKET = st.secrets.get("PRH_MARKETING_R2_BUCKET")

# Local data file
DATA_FILE = st.secrets.get("DATA_FILE")

# Encryption keys for datasets
DATA_KEY = st.secrets.get("DATA_KEY")


@dataclass(eq=True, frozen=True)
class SourceData:
    """In-memory copy of DB tables"""

    encounters_df: pd.DataFrame = None
    no_shows_df: pd.DataFrame = None
    patients_df: pd.DataFrame = None


def read() -> SourceData:
    if DATA_FILE:
        return from_file(DATA_FILE)
    else:
        return from_s3()

@st.cache_data
def from_s3() -> SourceData:
    logging.info("Fetching source data")
    r2_config = source_data_util.S3Config(R2_ACCT_ID, R2_ACCT_KEY, R2_URL)
    engine = source_data_util.sqlite_engine_from_s3(
        r2_config, R2_BUCKET, "prh-marketing.sqlite3.enc", DATA_KEY
    )
    source_data = from_sqlite_engine(engine)
    engine.dispose()
    source_data_util.cleanup()
    return source_data

def from_file(file: str) -> SourceData:
    engine = source_data_util.sqlite_engine_from_file(file)
    source_data = from_sqlite_engine(engine)
    engine.dispose()
    return source_data

def from_sqlite_engine(engine) -> SourceData:
    encounters_df = pd.read_sql_table("encounters", engine, index_col="id")
    no_shows_df = pd.read_sql_table("no_shows", engine, index_col="id")
    patients_df = pd.read_sql_table("patients", engine, index_col="id")
    return SourceData(encounters_df=encounters_df, no_shows_df=no_shows_df, patients_df=patients_df)

