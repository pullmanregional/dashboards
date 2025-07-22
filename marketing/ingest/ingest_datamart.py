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
    patients_df: pd.DataFrame
    panel_df: pd.DataFrame
    mychart_df: pd.DataFrame
    encounters_df: pd.DataFrame


@dataclass
class OutData:
    patients_df: pd.DataFrame
    encounters_df: pd.DataFrame
    no_shows_df: pd.DataFrame


# -------------------------------------------------------
# Extract
# -------------------------------------------------------
def read_source_tables(prw_engine) -> SrcData:
    """
    Read source tables from the warehouse DB
    """
    logging.info("Reading source tables")

    patients_df = pd.read_sql_query(
        select(
            text("prw_id"),
            text("age"),
        ).select_from(text("prw_patients")),
        prw_engine,
    )

    panel_df = pd.read_sql_query(
        select(
            text("prw_id"),
            text("panel_location"),
            text("panel_provider"),
        ).select_from(text("prw_patient_panels")),
        prw_engine,
    )

    mychart_df = pd.read_sql_query(
        select(
            text("prw_id"),
            text("mychart_status"),
            text("mychart_activation_date"),
        ).select_from(text("prw_mychart")),
        prw_engine,
    )

    encounters_df = pd.read_sql_query(
        select(
            text("prw_id"),
            text("dept"),
            text("encounter_date"),
            text("encounter_age"),
            text("encounter_type"),
            text("appt_status"),
        )
        .select_from(text("prw_encounters_outpt"))
        .where(text("appt_status = 'Completed' or appt_status = 'No Show'")),
        prw_engine,
    )

    # Set datetime column types
    mychart_df["mychart_activation_date"] = pd.to_datetime(
        mychart_df["mychart_activation_date"]
    )
    encounters_df["encounter_date"] = pd.to_datetime(encounters_df["encounter_date"])

    return SrcData(
        patients_df=patients_df,
        panel_df=panel_df,
        mychart_df=mychart_df,
        encounters_df=encounters_df,
    )


# -------------------------------------------------------
# Transform
# -------------------------------------------------------
def transform(src: SrcData) -> OutData:
    """
    Transform source data into datamart tables
    """
    # No shows encounters
    no_shows_df = src.encounters_df[src.encounters_df["appt_status"] == "No Show"]

    # Completed encounters
    completed_df = src.encounters_df[src.encounters_df["appt_status"] == "Completed"]

    # Add panel and mychart info to patients_df
    patients_df = src.patients_df.merge(src.panel_df, on="prw_id", how="left")
    patients_df = patients_df.merge(src.mychart_df, on="prw_id", how="left")

    return OutData(
        patients_df=patients_df,
        encounters_df=completed_df,
        no_shows_df=no_shows_df,
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

    # Write tables to datamart
    session = Session(out_engine)
    db_utils.clear_tables_and_insert_data(
        session,
        [
            db_utils.TableData(table=db.Patients, df=out.patients_df),
            db_utils.TableData(table=db.Encounters, df=out.encounters_df),
            db_utils.TableData(table=db.NoShows, df=out.no_shows_df),
        ],
    )

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
