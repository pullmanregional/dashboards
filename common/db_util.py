"""
DB Utility Functions
"""

import re, urllib, logging
import pandas as pd
import sqlalchemy
from datetime import datetime
from dataclasses import dataclass
from typing import List
from sqlmodel import SQLModel, Session, create_engine, delete


@dataclass
class TableData:
    """
    Associate a table with its data to update in a DB
    """

    table: SQLModel
    df: pd.DataFrame


# -------------------------------------------------------
# DB Utilities
# -------------------------------------------------------
def mask_pw(odbc_str: str) -> str:
    """
    Mask uid and pwd in ODBC connection string for logging
    """
    # Use regex to mask uid= and pwd= values
    masked_str = re.sub(r"(uid=|pwd=)[^;]*", r"\1****", odbc_str, flags=re.IGNORECASE)
    return masked_str


def get_db_connection(odbc_str: str, echo: bool = False) -> sqlalchemy.Engine:
    """
    Given an ODBC connection string, return a connection to the DB via SQLModel
    """
    # Split connection string into odbc prefix and parameters (ie everything after odbc_connect=)
    match = re.search(r"^(.*odbc_connect=)(.*)$", odbc_str)
    prefix = match.group(1) if match else ""
    params = match.group(2) if match else ""
    if prefix and params:
        # URL escape ODBC connection string
        conn_str = prefix + urllib.parse.quote_plus(params)
    else:
        # No odbc_connect= found, just original string
        conn_str = odbc_str

    # Use SQLModel to establish connection to DB
    try:
        engine = create_engine(conn_str, echo=echo)
        return engine
    except Exception as e:
        logging.error(f"ERROR: failed to connect to DB")
        logging.error(e)
        return None


def clear_tables_and_insert_data(session: Session, tables_data: List[TableData]):
    """
    Write data from dataframes to DB table, clearing and overwriting existing tabless
    """
    for table_data in tables_data:
        logging.info(f"Writing data to table: {table_data.table.__tablename__}")

        # Clear data in DB
        session.exec(delete(table_data.table))

        # Select columns from dataframe that match table columns, except "id" column
        table_columns = list(table_data.table.__table__.columns.keys())
        if "id" in table_columns:
            table_columns.remove("id")

        # Remove columns that aren't in the dataframe
        table_columns = [col for col in table_columns if col in table_data.df.columns]

        # Write data from dataframe
        df = table_data.df[table_columns]
        df.to_sql(
            name=table_data.table.__tablename__,
            con=session.connection(),
            if_exists="append",
            index=False,
        )


def write_meta(session: Session, meta_table: SQLModel):
    """
    Populate the meta table with updated time
    """
    logging.info("Writing metadata")

    # Clear and reset last ingest time
    session.exec(delete(meta_table))
    session.add(meta_table(modified=datetime.now()))
