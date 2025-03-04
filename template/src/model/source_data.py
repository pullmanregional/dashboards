"""
Source data as in-memory copy of all DB tables as dataframes
"""

import logging
import pandas as pd
import streamlit as st
from dataclasses import dataclass
from common import source_data_util

# Cloudflare R2 connection
R2_ACCT_ID = st.secrets.get("PRH_SAMPLE_R2_ACCT_ID")
R2_ACCT_KEY = st.secrets.get("PRH_SAMPLE_R2_ACCT_KEY")
R2_URL = st.secrets.get("PRH_SAMPLE_R2_URL")
R2_BUCKET = st.secrets.get("PRH_SAMPLE_R2_BUCKET")

# Encryption keys for datasets
DATA_KEY = st.secrets.get("DATA_KEY")


@dataclass(eq=True, frozen=True)
class SourceData:
    """In-memory copy of DB tables"""

    df: pd.DataFrame = None
    kvdata: dict = None


@st.cache_data
def from_s3() -> SourceData:
    logging.info("Fetching source data")
    r2_config = source_data_util.S3Config(R2_ACCT_ID, R2_ACCT_KEY, R2_URL)
    engine = source_data_util.sqlite_engine_from_s3(
        r2_config, R2_BUCKET, "prh-sample.sqlite3.enc", DATA_KEY
    )
    kvdata = source_data_util.json_from_s3(
        r2_config, R2_BUCKET, "prh-sample.json.enc", DATA_KEY
    )
    df = pd.read_sql_table("table_name", engine)
    engine.dispose()
    source_data_util.cleanup()
    return SourceData(df=df, kvdata=kvdata)
