"""
Source data as in-memory copy of all DB tables as dataframes
"""

import logging, json
import pandas as pd
import streamlit as st
import datetime as dt
from dataclasses import dataclass
from common import source_data_util

# Cloudflare R2 connection
R2_ACCT_ID = st.secrets.get("PRH_RVUPEDS_R2_ACCT_ID")
R2_ACCT_KEY = st.secrets.get("PRH_RVUPEDS_R2_ACCT_KEY")
R2_URL = st.secrets.get("PRH_RVUPEDS_R2_URL")
R2_BUCKET = st.secrets.get("PRH_RVUPEDS_R2_BUCKET")

# Local data file
DATA_FILE = st.secrets.get("DATA_FILE")

# Encryption keys for datasets
DATA_KEY = st.secrets.get("DATA_KEY")


@dataclass(eq=True)
class SourceData:
    """In-memory copy of DB tables"""

    charges_df: pd.DataFrame
    providers: list[str]
    start_date: dt.date
    end_date: dt.date

    modified: dt.datetime = None


def read() -> SourceData:
    if DATA_FILE:
        return from_file(DATA_FILE)
    else:
        return from_s3()


@st.cache_data(ttl=dt.timedelta(minutes=2))
def from_file(db_file: str) -> SourceData:
    engine = source_data_util.sqlite_engine_from_file(db_file)
    source_data = from_db(engine)
    engine.dispose()
    return source_data


@st.cache_data(ttl=dt.timedelta(hours=6), show_spinner="Loading...")
def from_s3() -> SourceData:
    logging.info("Fetching source data")
    r2_config = source_data_util.S3Config(R2_ACCT_ID, R2_ACCT_KEY, R2_URL)
    engine = source_data_util.sqlite_engine_from_s3(
        r2_config, R2_BUCKET, "prh-rvupeds.sqlite3.enc", DATA_KEY
    )
    source_data = from_db(engine)
    engine.dispose()

    source_data_util.cleanup()
    return source_data


def from_db(db_engine) -> SourceData:
    """
    Read all data from specified DB connection into memory and return as dataframes
    """
    logging.info("Reading DB tables")

    # Get the latest time data was updated from meta table
    result = pd.read_sql_query("SELECT MAX(modified) FROM meta", db_engine)
    modified = result.iloc[0, 0] if result.size > 0 else None

    # Read charges data. Exclude facility charges and charges with no RVUs
    charges_df = pd.read_sql_query(
        """
        SELECT 
            prw_id,
            date,
            posted_date,
            provider,
            cpt,
            modifiers,
            cpt_desc,
            quantity,
            wrvu,
            reversal_reason,
            insurance_class,
            location,
            month,
            quarter,
            posted_month,
            posted_quarter,
            medicaid,
            inpatient
        FROM charges 
    """,
        db_engine,
        parse_dates=["date", "posted_date"],
        dtype={"medicaid": bool, "inpatient": bool},
    )

    # Get key/value data from the first row
    kv_data_df = pd.read_sql_query("SELECT data FROM _kv LIMIT 1", db_engine)
    kv_data = json.loads(kv_data_df.iloc[0]["data"])
    providers = kv_data["providers"]
    start_date = dt.datetime.strptime(kv_data["start_date"], "%Y-%m-%d").date()
    end_date = dt.datetime.strptime(kv_data["end_date"], "%Y-%m-%d").date()

    return SourceData(
        modified=modified,
        charges_df=charges_df,
        providers=providers,
        start_date=start_date,
        end_date=end_date,
    )
