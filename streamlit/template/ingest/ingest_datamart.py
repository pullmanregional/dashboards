import sys
import os
import shutil
import logging
import pandas as pd
from dataclasses import dataclass
from sqlmodel import Session, select, text

# Add project root and repo roots so we can import common modules and from ../src/
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
from src.model import db
from prw_common import db_utils
from prw_common import cli_utils
from prw_common.encrypt import encrypt_file
from prw_common.remote_utils import upload_file_to_s3


# -------------------------------------------------------
# Types
# -------------------------------------------------------
@dataclass
class SrcData:
    data_df: pd.DataFrame


@dataclass
class OutData:
    data_df: pd.DataFrame


# -------------------------------------------------------
# Extract
# -------------------------------------------------------
def read_source_tables(prw_engine) -> SrcData:
    """
    Read source tables from the warehouse DB
    """
    logging.info("Reading source tables")

    data_df = pd.read_sql_query(
        select(text("id")).select_from(text("table")),
        prw_engine,
    )
    return SrcData(data_df=data_df)


# -------------------------------------------------------
# Transform
# -------------------------------------------------------
def transform(src: SrcData) -> OutData:
    """
    Transform source data into datamart tables
    """
    return OutData(
        data_df=src.data_df,
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
        "--key",
        help="Encrypt with given key. Must be specified to upload to S3. Defaults to no encryption if not specified.",
    )
    return parser.parse_args()


def error_exit(msg):
    logging.error(msg)
    exit(1)


def main():
    args = parse_arguments()
    prw_db_url = args.prw
    output_db_file = args.out
    encrypt_key = None if args.key is None or args.key.lower() == "none" else args.key
    s3_url = args.s3url
    s3_auth = args.s3auth
    tmp_db_file = "datamart.sqlite3"

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

    # Calculate key/value data
    kv_data = {}

    # Write tables to datamart
    session = Session(out_engine)
    db_utils.clear_tables_and_insert_data(
        session, [db_utils.TableData(table=db.DataTable, df=out.data_df)]
    )
    db_utils.write_kv_table(kv_data, session, db.KvTable)

    # Update last ingest time and modified times for source data files
    db_utils.write_meta(session, db.Meta)
    session.commit()

    # Finally encrypt output files, or just copy if no encryption key is provided
    if encrypt_key and encrypt_key.lower() != "none":
        encrypt_file(tmp_db_file, output_db_file, encrypt_key)
    else:
        shutil.copy(tmp_db_file, output_db_file)

    # Cleanup
    os.remove(tmp_db_file)
    prw_engine.dispose()
    out_engine.dispose()

    # Upload to S3. Only upload encrypted content.
    if encrypt_key and s3_url and s3_auth:
        upload_file_to_s3(s3_url, s3_auth, output_db_file)

    logging.info("Done")


if __name__ == "__main__":
    main()
