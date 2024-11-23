"""
Source data as in-memory copy of all DB tables as dataframes
"""

import os
import logging
import pandas as pd
import streamlit as st
from dataclasses import dataclass
from datetime import datetime
from sqlmodel import Session, text
from common import source_data_util

# Path to default app database: panel.sqlite3 next to ingest.py
DB_FILE = "panel.sqlite3"
LOCAL_DB_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", DB_FILE
)

# Remote URL in Cloudflare R2
R2_ACCT_ID = st.secrets.get("PRH_PANEL_R2_ACCT_ID")
R2_ACCT_KEY = st.secrets.get("PRH_PANEL_R2_ACCT_KEY")
R2_URL = st.secrets.get("PRH_PANEL_R2_URL")
R2_BUCKET = st.secrets.get("PRH_PANEL_R2_BUCKET")
R2_OBJECT = DB_FILE + ".enc"

# Encryption key for remote database
DATA_KEY = st.secrets.get("PRH_PANEL_DATA_KEY")


@dataclass(eq=True, frozen=True)
class SourceData:
    """In-memory copy of DB tables"""

    patients_df: pd.DataFrame = None
    encounters_df: pd.DataFrame = None

    modified: datetime = None


@st.cache_data
def from_file(file=LOCAL_DB_PATH) -> SourceData:
    engine = source_data_util.sqlite_engine_from_file(file)
    src_data = from_db(engine)
    engine.dispose()
    return src_data


@st.cache_data
def from_s3() -> SourceData:
    r2_config = source_data_util.S3Config(R2_ACCT_ID, R2_ACCT_KEY, R2_URL)
    engine = source_data_util.sqlite_engine_from_s3(
        r2_config, R2_BUCKET, R2_OBJECT, DATA_KEY
    )
    src_data = from_db(engine)
    engine.dispose()
    source_data_util.cleanup()
    return src_data


def from_db(db_engine) -> SourceData:
    """
    Read all data from specified DB connection into memory and return as dataframes
    """
    logging.info("Reading DB tables")

    # Read the largest last_updated value from Meta
    with Session(db_engine) as session:
        modified = session.exec(text("select max(modified) from meta")).fetchone()[0]

    # Read dashboard data into dataframes
    return SourceData(
        modified=modified,
        patients_df=pd.read_sql_table("patients", db_engine),
        encounters_df=pd.read_sql_table("encounters", db_engine),
    )
