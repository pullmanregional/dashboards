import os, logging
import sqlite3
import boto3
import streamlit as st
from common import encrypt
from botocore.exceptions import NoCredentialsError, PartialCredentialsError
from sqlalchemy import create_engine


# Remote URL in Cloudflare R2
R2_ACCT_ID = st.secrets.get("PRH_EXPLORE_R2_ACCT_ID")
R2_ACCT_KEY = st.secrets.get("PRH_EXPLORE_R2_ACCT_KEY")
R2_URL = st.secrets.get("PRH_EXPLORE_R2_URL")
R2_BUCKET = st.secrets.get("PRH_EXPLORE_R2_BUCKET")

TMP_FILE = "tmp.sqlite3"


def connect_s3(
    acct_id=R2_ACCT_ID,
    acct_key=R2_ACCT_KEY,
    url=R2_URL,
    bucket=R2_BUCKET,
    obj=None,
    data_key=None,
):
    """
    Fetches the SQLite database file from a remote S3-compatible storage, decrypts it,
    and loads it into an in-memory SQLite database.
    Returns a SQLAlchemy engine to the SQLite database in memory.
    """
    if obj is None:
        raise ValueError("Object key is required")

    try:
        # Initialize the S3 client
        logging.info("Fetch remote DB file")
        s3_client = boto3.client(
            "s3",
            endpoint_url=url,
            region_name="auto",
            aws_access_key_id=acct_id,
            aws_secret_access_key=acct_key,
        )

        # Fetch the encrypted database file from the remote storage
        response = s3_client.get_object(Bucket=bucket, Key=obj)
        remote_db = response["Body"].read()

        # Decrypt the database file
        logging.info("Decrypting")
        decrypted_db = (
            encrypt.decrypt(remote_db, data_key) if data_key is not None else remote_db
        )

        # Write the decrypted database to an in-memory SQLite database
        logging.info("Reading DB to memory")
        open(TMP_FILE, "wb").write(decrypted_db)
        conn = sqlite3.connect(TMP_FILE)
        return engine_from_conn(conn)

    except (NoCredentialsError, PartialCredentialsError) as e:
        logging.error("Credentials error: %s", e)
        raise
    except Exception as e:
        logging.error("Failed to fetch and load remote database: %s", e)
        raise


def engine_from_conn(conn):
    """
    Returns a SQLAlchemy engine object from a sqlite3 connection object.
    Returns sqlalchemy.engine.base.Connection as a connection object from the given the SQLite database connection
    """
    return create_engine(f"sqlite://", creator=lambda: conn)


def cleanup():
    """
    Delete any temporary file
    """
    os.remove(TMP_FILE)
