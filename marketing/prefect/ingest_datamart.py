import sys
import os
import shutil
import logging
import pandas as pd
from dataclasses import dataclass
from sqlmodel import Session, select, text, create_engine

# Add project root and repo roots so we can import common modules and from ../src/
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
from src.model import db
from common import db_util
from prw_common.cli_utils import cli_parser
from prw_common.encrypt import encrypt_file


# -------------------------------------------------------
# Types
# -------------------------------------------------------
@dataclass
class SrcData:
    patients_df: pd.DataFrame
    encounters_df: pd.DataFrame


@dataclass
class OutData:
    patients_df: pd.DataFrame
    encounters_df: pd.DataFrame


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

    encounters_df = pd.read_sql_query(
        select(
            text("prw_id"),
            text("dept"),
            text("encounter_date"),
            text("encounter_age"),
            text("encounter_type"),
        )
        .select_from(text("prw_encounters"))
        .where(text("appt_status = 'Completed'")),
        prw_engine,
    )

    # Set datetime column types
    encounters_df["encounter_date"] = pd.to_datetime(encounters_df["encounter_date"])

    return SrcData(patients_df=patients_df, encounters_df=encounters_df)


# -------------------------------------------------------
# Transform
# -------------------------------------------------------
def transform(src: SrcData) -> OutData:
    """
    Transform source data into datamart tables
    """
    # Convert datetime encounter_date column to an int in the format YYYYMMDD
    encounters_df = src.encounters_df.copy()
    encounters_df["encounter_date"] = encounters_df["encounter_date"].dt.strftime("%Y%m%d")

    return OutData(
        patients_df=src.patients_df,
        encounters_df=encounters_df,
    )


# -------------------------------------------------------
# Main entry point
# -------------------------------------------------------
def parse_arguments():
    parser = cli_parser(
        description="Ingest data from PRW warehouse to datamart.",
        require_prw=True,
        require_out=True,
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
    encrypt_key = args.key
    tmp_db_file = "datamart.sqlite3"

    # Create the sqlite output database and create the tables as defined in ../src/model/db.py
    out_engine = create_engine(f"sqlite:///{tmp_db_file}")
    db.DatamartModel.metadata.create_all(out_engine)

    # Read from PRW warehouse (MSSQL in prod, sqlite in dev)
    prw_engine = create_engine(prw_db_url)
    src = read_source_tables(prw_engine)
    if src is None:
        error_exit("ERROR: failed to read source data (see above)")

    # Transform data
    out = transform(src)

    # Write tables to datamart
    session = Session(out_engine)
    db_util.clear_tables_and_insert_data(
        session,
        [
            db_util.TableData(table=db.Patients, df=out.patients_df),
            db_util.TableData(table=db.Encounters, df=out.encounters_df),
        ],
    )

    # Update last ingest time and modified times for source data files
    db_util.write_meta(session, db.Meta)
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
    print("Done")


if __name__ == "__main__":
    main()
