import sys, os

# Add project root and repo roots so we can import common modules and from ../src/
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))

import shutil
import json
import logging
import pandas as pd
from dataclasses import dataclass
from sqlmodel import Session
from prw_common.encrypt import encrypt_file
from prw_common import db_utils
from prw_common import cli_utils
from prw_common.remote_utils import upload_file_to_s3
from src.model import db


# -------------------------------------------------------
# Types
# -------------------------------------------------------
@dataclass
class SrcData:
    volumes_df: pd.DataFrame = None
    uos_df: pd.DataFrame = None
    budget_df: pd.DataFrame = None
    hours_df: pd.DataFrame = None
    contracted_hours_df: pd.DataFrame = None
    contracted_hours_meta_df: pd.DataFrame = None
    income_stmt_df: pd.DataFrame = None
    balance_sheet_df: pd.DataFrame = None
    aged_ar_df: pd.DataFrame = None


@dataclass
class OutData:
    volumes_df: pd.DataFrame
    uos_df: pd.DataFrame
    budget_df: pd.DataFrame
    hours_df: pd.DataFrame
    contracted_hours_df: pd.DataFrame
    income_stmt_df: pd.DataFrame
    balance_sheet_df: pd.DataFrame
    aged_ar_df: pd.DataFrame

    kv: dict


# -------------------------------------------------------
# Extract
# -------------------------------------------------------
def read_source_tables(prw_engine) -> SrcData:
    """
    Read source tables from the warehouse DB
    """
    logging.info("Reading source tables")

    volumes_df = pd.read_sql_table("prw_volumes", prw_engine, index_col="id")
    uos_df = pd.read_sql_table("prw_uos", prw_engine, index_col="id")
    budget_df = pd.read_sql_table("prw_budget", prw_engine, index_col="id")
    hours_df = pd.read_sql_table("prw_hours", prw_engine, index_col="id")
    contracted_hours_df = pd.read_sql_table(
        "prw_contracted_hours", prw_engine, index_col="id"
    )
    contracted_hours_meta_df = pd.read_sql_table(
        "prw_contracted_hours_meta", prw_engine, index_col="id"
    )
    income_stmt_df = pd.read_sql_table("prw_income_stmt", prw_engine, index_col="id")
    balance_sheet_df = pd.read_sql_table(
        "prw_balance_sheet", prw_engine, index_col="id"
    )
    aged_ar_df = pd.read_sql_table("prw_aged_ar", prw_engine, index_col="id")

    return SrcData(
        volumes_df=volumes_df,
        uos_df=uos_df,
        budget_df=budget_df,
        hours_df=hours_df,
        contracted_hours_df=contracted_hours_df,
        contracted_hours_meta_df=contracted_hours_meta_df,
        income_stmt_df=income_stmt_df,
        balance_sheet_df=balance_sheet_df,
        aged_ar_df=aged_ar_df,
    )


# -------------------------------------------------------
# Transform
# -------------------------------------------------------
def transform(src: SrcData) -> OutData:
    """
    Transform source data into datamart tables
    """
    logging.info("Transforming data")

    volumes_df = src.volumes_df
    uos_df = src.uos_df
    budget_df = src.budget_df
    hours_df = src.hours_df
    contracted_hours_df = src.contracted_hours_df
    income_stmt_df = src.income_stmt_df
    balance_sheet_df = src.balance_sheet_df
    aged_ar_df = src.aged_ar_df

    # Only keep latest year of budget data
    budget_df = budget_df[budget_df["year"] == budget_df["year"].max()]

    # Calculate balance sheet variances
    balance_sheet_df["diff_prev_month"] = (
        balance_sheet_df["actual"] - balance_sheet_df["actual_prev_month"]
    )
    balance_sheet_df["diff_prev_year"] = (
        balance_sheet_df["actual"] - balance_sheet_df["actual_prev_year"]
    )

    contracted_hours_updated_month = src.contracted_hours_meta_df.iloc[0][
        "contracted_hours_updated_month"
    ]

    return OutData(
        volumes_df=volumes_df,
        uos_df=uos_df,
        budget_df=budget_df,
        hours_df=hours_df,
        contracted_hours_df=contracted_hours_df,
        income_stmt_df=income_stmt_df,
        balance_sheet_df=balance_sheet_df,
        aged_ar_df=aged_ar_df,
        kv={
            "contracted_hours_updated_month": contracted_hours_updated_month,
        },
    )


# -------------------------------------------------------
# Main entry point
# -------------------------------------------------------
def parse_arguments():
    parser = cli_utils.cli_parser(
        description="Ingest data from PRW warehouse to datamart.",
        require_prw=True,
        require_out=True,
    )
    cli_utils.add_s3_args(parser)
    parser.add_argument(
        "--kv",
        help="Output key/value data file path",
        required=True,
    )
    parser.add_argument(
        "--key",
        help="Encrypt with given key. Defaults to no encryption if not specified.",
    )
    return parser.parse_args()


def error_exit(msg):
    logging.error(msg)
    exit(1)


def main():
    args = parse_arguments()
    prw_db_url = args.prw
    output_db_file = args.out
    output_kv_file = args.kv
    encrypt_key = None if args.key is None or args.key.lower() == "none" else args.key
    s3_url = args.s3url
    s3_auth = args.s3auth
    tmp_db_file = "datamart.sqlite3"
    tmp_kv_file = "datamart.json"

    logging.info(
        f"Input: {db_utils.mask_conn_pw(prw_db_url)}, output: {output_db_file}, encrypt: {encrypt_key is not None}, upload: {s3_url}",
        flush=True,
    )

    # Create the sqlite output database and create the tables as defined in ../src/model/db.py
    out_engine = db_utils.get_db_connection(f"sqlite:///{tmp_db_file}")
    db.DatamartModel.metadata.create_all(out_engine)

    # Read from PRW warehouse (MSSQL in prod, sqlite in dev)
    prw_engine = db_utils.get_db_connection(prw_db_url)
    src = read_source_tables(prw_engine)
    if src is None:
        error_exit("ERROR: failed to read source data (see above)")

    # Transform data
    out = transform(src)

    # Write tables to datamart
    session = Session(out_engine)
    db_utils.clear_tables_and_insert_data(
        session,
        [
            db_utils.TableData(table=db.Volume, df=out.volumes_df),
            db_utils.TableData(table=db.UOS, df=out.uos_df),
            db_utils.TableData(table=db.Budget, df=out.budget_df),
            db_utils.TableData(table=db.Hours, df=out.hours_df),
            db_utils.TableData(table=db.ContractedHours, df=out.contracted_hours_df),
            db_utils.TableData(table=db.IncomeStmt, df=out.income_stmt_df),
            db_utils.TableData(table=db.BalanceSheet, df=out.balance_sheet_df),
            db_utils.TableData(table=db.AgedAR, df=out.aged_ar_df),
        ],
    )
    db_utils.write_kv_table(out.kv, session, db.KvTable)

    # Update last ingest time and modified times for source data files
    db_utils.write_meta(session, db.Meta)
    session.commit()

    # Write to the output key/value file as JSON for backward compatibility
    with open(tmp_kv_file, "w") as f:
        json.dump(out.kv, f, indent=2)

    # Finally encrypt output files
    if encrypt_key and encrypt_key.lower() != "none":
        encrypt_file(tmp_db_file, output_db_file, encrypt_key)
        encrypt_file(tmp_kv_file, output_kv_file, encrypt_key)
    else:
        # Copy files to output paths if no encryption key is provided
        shutil.copy(tmp_db_file, output_db_file)
        shutil.copy(tmp_kv_file, output_kv_file)

    # Clean up tmp files
    os.remove(tmp_db_file)
    os.remove(tmp_kv_file)
    prw_engine.dispose()
    out_engine.dispose()

    # Upload to S3. Only upload encrypted content.
    if encrypt_key and s3_url and s3_auth:
        upload_file_to_s3(s3_url, s3_auth, output_db_file)
        upload_file_to_s3(s3_url, s3_auth, output_kv_file)

    logging.info("Done")


if __name__ == "__main__":
    main()
