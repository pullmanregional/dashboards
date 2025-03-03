"""
Utilities for fetching and loading data from remote storage.
"""

import os, logging, json
import sqlite3
import boto3
from dataclasses import dataclass
from botocore.exceptions import NoCredentialsError, PartialCredentialsError
from sqlalchemy import create_engine
from cryptography.fernet import Fernet


# Temporary storage when loading DB from memory
TMP_DB_FILE = "tmp.sqlite3"


@dataclass(eq=True, frozen=True)
class S3Config:
    """Configuration for an S3 connection"""

    acct_id: str
    acct_key: str
    url: str
    region: str = "auto"


# -------------------------------------------------------
# S3 Utilities
# -------------------------------------------------------
def fetch_from_s3(
    s3_config: S3Config, bucket: str, obj: str, data_key: str = None
) -> bytes:
    """
    Fetches a file from a remote S3-compatible storage, decrypts it,
    and returns the bytes.
    """
    try:
        # Initialize the S3 client
        logging.info("Fetch remote S3 object")
        s3_client = boto3.client(
            "s3",
            endpoint_url=s3_config.url,
            region_name=s3_config.region,
            aws_access_key_id=s3_config.acct_id,
            aws_secret_access_key=s3_config.acct_key,
        )

        # Fetch the encrypted file from the remote storage
        response = s3_client.get_object(Bucket=bucket, Key=obj)
        remote_bytes = response["Body"].read()

        # Decrypt the database file using provided Fernet key
        logging.info("Decrypting")
        decrypted_bytes = (
            Fernet(data_key).decrypt(remote_bytes) if data_key is not None else remote_bytes
        )

        return decrypted_bytes

    except (NoCredentialsError, PartialCredentialsError) as e:
        logging.error("Credentials error: %s", e)
        raise
    except Exception as e:
        logging.error("Failed to fetch and load remote object: %s", e)
        raise


def json_from_s3(
    s3_config: S3Config, bucket: str, obj: str, data_key: str = None
) -> dict:
    """
    Fetches a json file from a remote S3-compatible storage, decrypts it,
    and loads it into a dictionary.
    """
    data = fetch_from_s3(s3_config, bucket, obj, data_key)
    return json.loads(data)


def sqlite_engine_from_s3(
    s3_config: S3Config, bucket: str, obj: str, data_key: str = None
):
    """
    Fetches the SQLite database file from a remote S3-compatible storage, decrypts it,
    and loads it into a temporary SQLite database.
    Returns a SQLAlchemy engine to the SQLite database in memory.
    """
    data = fetch_from_s3(s3_config, bucket, obj, data_key)
    # Write the decrypted database to a temporary SQLite database
    logging.info("Reading DB to memory")
    open(TMP_DB_FILE, "wb").write(data)
    conn = sqlite3.connect(TMP_DB_FILE)
    return create_engine(f"sqlite://", creator=lambda: conn)


def sqlite_engine_from_file(file):
    """
    Reads the specified SQLite database file and returns a SQLAlchemy engine.
    """
    conn = sqlite3.connect(file)
    return create_engine(f"sqlite://", creator=lambda: conn)


def cleanup():
    """
    Delete any temporary file
    """
    os.remove(TMP_DB_FILE)
