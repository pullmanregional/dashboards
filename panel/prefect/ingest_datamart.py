import sys
import os
import shutil
import json
import logging
import pandas as pd
from dataclasses import dataclass
from sqlmodel import Session, select, text, create_engine

# Add project root and repo roots so we can import common modules and from ../src/
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
from src.model import db
from prw_common import db_utils
from prw_common.cli_utils import cli_parser
from prw_common.encrypt import encrypt_file


# -------------------------------------------------------
# Types
# -------------------------------------------------------
@dataclass
class SrcData:
    patients_df: pd.DataFrame
    patient_panel_df: pd.DataFrame
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

    patients_df = pd.read_sql_table("prw_patients", prw_engine)
    patient_panel_df = pd.read_sql_table("prw_patient_panels", prw_engine)
    encounters_df = pd.read_sql_table("prw_encounters", prw_engine)
    return SrcData(patients_df=patients_df, patient_panel_df=patient_panel_df, encounters_df=encounters_df)


# -------------------------------------------------------
# Transform
# -------------------------------------------------------
CLINIC_IDS = {
    "CC WPL PULLMAN FAMILY MEDICINE": "Pullman Family Medicine",
    "CC WPL PALOUSE HEALTH CTR PRIM CARE": "Pullman Family Medicine (Palouse Health Center)",
    "CC WPL FM RESIDENCY CLINIC": "Residency",
    "CC WPL PALOUSE PEDIATRICS PULLMAN": "Palouse Pediatrics Pullman",
    "CC WPL PALOUSE PEDIATRICS MOSCOW": "Palouse Pediatrics Moscow",
    "CC WPL PALOUSE MED PRIMARY CARE": "Palouse Medical",
}
ENCOUNTER_TYPES = {
    "CC WELL CH": "Well",
    "CCWELLBABY": "Well",
    "WELLNESS": "Well",
}


def transform(src: SrcData) -> OutData:
    """
    Transform source data into datamart tables
    """
    logging.info("Transforming data")
    # Patients
    patients_df = src.patients_df.copy()

    # age (floor of age in years) and age_in_mo (if < 2 years old)
    patients_df["age_display"] = patients_df.apply(
        lambda row: (
            f"{int(row['age_in_mo_under_3'])}m" if row["age"] < 2 else str(row["age"])
        ),
        axis=1,
    )

    # Combine city and state into location column
    patients_df["city"] = patients_df["city"].str.title()
    patients_df["state"] = patients_df["state"].str.upper()
    patients_df["location"] = patients_df["city"] + ", " + patients_df["state"]

    # Copy panel_location and panel_provider from patient_panel_df based on prw_id
    patients_df["panel_location"] = patients_df["prw_id"].map(
        src.patient_panel_df.set_index("prw_id")["panel_location"]
    )
    patients_df["panel_provider"] = patients_df["prw_id"].map(
        src.patient_panel_df.set_index("prw_id")["panel_provider"]
    )

    # Delete unused columns
    patients_df.drop(
        columns=[
            "city",
            "state",
        ],
        inplace=True,
    )

    # Encounters
    encounters_df = src.encounters_df.copy()

    # Force date columns to be date only, no time
    encounters_df["encounter_date"] = pd.to_datetime(
        encounters_df["encounter_date"].astype(str), format="%Y%m%d"
    ).dt.date
    # Map encounter location to clinic IDs
    encounters_df["location"] = encounters_df["dept"].map(CLINIC_IDS)

    # Map encounter types, keeping original value if not found in ENCOUNTER_TYPES
    encounters_df["encounter_type"] = (
        encounters_df["encounter_type"]
        .map(ENCOUNTER_TYPES)
        .fillna(encounters_df["encounter_type"])
    )

    # Delete unused columns: dept, encounter_time, billing_provider, appt_status
    encounters_df.drop(
        columns=[
            "dept",
            "encounter_time",
            "billing_provider",
            "appt_status",
        ],
        inplace=True,
    )

    return OutData(patients_df=patients_df, encounters_df=encounters_df)


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
    print(
        f"Input: {db_utils.mask_conn_pw(prw_db_url)}, Output: {output_db_file}",
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
            db_utils.TableData(table=db.Patient, df=out.patients_df),
            db_utils.TableData(table=db.Encounter, df=out.encounters_df),
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

    # Clean up tmp files
    os.remove(tmp_db_file)
    prw_engine.dispose()
    out_engine.dispose()
    print("Done")


if __name__ == "__main__":
    main()
