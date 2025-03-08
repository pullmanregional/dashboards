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
    encounters_df = pd.read_sql_table("prw_encounters", prw_engine)
    return SrcData(patients_df=patients_df, encounters_df=encounters_df)


# -------------------------------------------------------
# Transform
# -------------------------------------------------------
PROVIDER_TO_LOCATION = {
    "Sangha, Dildeep [6229238]": "CC WPL PULLMAN FAMILY MEDICINE",
    "Olawuyi, Damola Bolutife [7191596]": "CC WPL FM RESIDENCY CLINIC",
    "CC WPL FM RESIDENCY CLIN SUP [75007097]": "CC WPL FM RESIDENCY CLINIC",
    "Davis, Jennifer [54070483]": "CC WPL PALOUSE HEALTH CENTER",
    "Boyd, Jeana M [6628044]": "CC WPL PULLMAN FAMILY MEDICINE",
    "White, Malia [80012005]": "CC WPL PULLMAN FAMILY MEDICINE",
    "CC WPL PULLMAN FM LAB [75007146]": "CC WPL PULLMAN FAMILY MEDICINE",
    "Hatley, Shannon M [6134031]": "CC WPL PULLMAN FAMILY MEDICINE",
    "Adkins, Benjamin J [50032100]": "CC WPL PULLMAN FAMILY MEDICINE",
    "Guida, Kimberley [50032826]": "CC WPL PULLMAN FAMILY MEDICINE",
    "Ward, Jeffrey Loren [5746915]": "CC WPL FM RESIDENCY CLINIC",
    "Harris, Brenna R [54981938]": "CC WPL FM RESIDENCY CLINIC",
    "Brodsky, Kaz B [55037680]": "CC WPL PULLMAN FAMILY MEDICINE",
    "Smith, Angeline Elizabeth [5656055]": "CC WPL PALOUSE HEALTH CENTER",
    "Cargill, Teresa [55064229]": "CC WPL PULLMAN FAMILY MEDICINE",
    "Thompson, Molly [55040931]": "CC WPL FM RESIDENCY CLINIC",
    "Perin, Karly [7950541]": "CC WPL FM RESIDENCY CLINIC",
    "Younes, Mohammed [5772847]": "CC WPL FM RESIDENCY CLINIC",
    "CC WPL PULLMAN FM CLIN SUP [75007096]": "CC WPL PULLMAN FAMILY MEDICINE",
    "Mader, Kelsey [S6148634]": "CC WPL FM RESIDENCY CLINIC",
    "Shakir, Tuarum N [6411322]": "CC WPL FM RESIDENCY CLINIC",
    "Frostad, Michael [50032808]": "CC WPL PALOUSE PEDIATRICS MOSCOW",
    "Hryniewicz, Kathryn [54977206]": "CC WPL PALOUSE PEDIATRICS MOSCOW",
    "Rinaldi, Mackenzie Claire [N9170397]": "CC WPL PALOUSE PEDIATRICS PULLMAN",
    "Shields, Maricarmen [55020855]": "CC WPL PALOUSE PEDIATRICS MOSCOW",
    "Lee, Jonathan [X9162396]": "CC WPL PALOUSE PEDIATRICS PULLMAN",
    "CC WPL PAL PEDS PULLMAN CLIN SUP [75007092]": "CC WPL PALOUSE PEDIATRICS PULLMAN",
    "Gordon, Methuel [54062579]": "CC WPL PALOUSE PEDIATRICS PULLMAN",
    "CC WPL PALOUSE HEALTH CTR CLIN SUP [75007095]": "CC WPL PALOUSE HEALTH CENTER",
    "CC WPL PULLMAN FM AWV [75007145]": "CC WPL PULLMAN FAMILY MEDICINE",
    "CC WPL PAL PEDS MOSCOW CLIN SUP [75007094]": "CC WPL PALOUSE PEDIATRICS MOSCOW",
    "CC WPL PULLMAN FM RESPIRATORY RM [75007144]": "CC WPL PULLMAN FAMILY MEDICINE",
    "Manderville, Tracy [8570166]": "CC WPL PALOUSE PEDIATRICS PULLMAN",
    "CC WPL PULLMAN FM PROCEDURE [75007142]": "CC WPL PULLMAN FAMILY MEDICINE",
    "CC WPL PULLMAN FM UC WALK IN [75007143]": "CC WPL PULLMAN FAMILY MEDICINE",
    "CC WPL PULLMAN PEDS FLU CLINIC [75007168]": "CC WPL PALOUSE PEDIATRICS PULLMAN",
    "CC WPL MOSCOW PEDS FLU CLINIC [75007169]": "CC WPL PALOUSE PEDIATRICS MOSCOW",
    "Clinic, Pullman Fam Med Residency [75007538]": "CC WPL FM RESIDENCY CLINIC",
}
CLINIC_IDS = {
    "CC WPL PULLMAN FAMILY MEDICINE": "Pullman Family Medicine",
    "CC WPL PALOUSE HEALTH CENTER": "Pullman Family Medicine",
    "CC WPL FM RESIDENCY CLINIC": "Residency",
    "CC WPL PALOUSE PEDIATRICS PULLMAN": "Palouse Pediatrics Pullman",
    "CC WPL PALOUSE PEDIATRICS MOSCOW": "Palouse Pediatrics Moscow",
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
        lambda row: f"{int(row['age_mo'])}m" if row["age"] < 2 else str(row["age"]),
        axis=1,
    )

    # Combine city and state into location column
    patients_df["city"] = patients_df["city"].str.title()
    patients_df["state"] = patients_df["state"].str.upper()
    patients_df["location"] = patients_df["city"] + ", " + patients_df["state"]

    # For now, we're just going to assign the panel location based on the provider of the first encounter in the list
    first_encounters = (
        src.encounters_df.groupby("prw_id")["service_provider"].first().reset_index()
    )
    patients_df = patients_df.merge(
        first_encounters, on="prw_id", how="left", suffixes=("", "_first")
    )
    patients_df["panel_location"] = (
        patients_df["service_provider"]
        .str.split("\n")
        .str[0]
        .map(PROVIDER_TO_LOCATION)
        .map(CLINIC_IDS)
    )

    # And, just copy pcp as the paneled provider
    patients_df["panel_provider"] = patients_df["pcp"]

    # Delete unused columns: dob, name, address, zip, phone, email
    patients_df.drop(
        columns=[
            "id",
            "service_provider",
            "city",
            "state",
        ],
        inplace=True,
    )

    # Encounters
    encounters_df = src.encounters_df.copy()

    # Force date columns to be date only, no time
    encounters_df["encounter_date"] = pd.to_datetime(
        encounters_df["encounter_date"]
    ).dt.date

    # Map encounter location to clinic IDs
    encounters_df["location"] = encounters_df["location"].map(CLINIC_IDS)

    # Remove anything in trailing [] using a regex in the "service_provider" and "type" columns
    encounters_df["service_provider"] = encounters_df["service_provider"].str.replace(
        r"\s*\[.*?\]\s*", "", regex=True
    )
    encounters_df["encounter_type"] = encounters_df["encounter_type"].str.replace(
        r"\s*\[.*?\]\s*", "", regex=True
    )

    # Map encounter types, keeping original value if not found in ENCOUNTER_TYPES
    encounters_df["encounter_type"] = (
        encounters_df["encounter_type"]
        .map(ENCOUNTER_TYPES)
        .fillna(encounters_df["encounter_type"])
    )

    # Rewrite level_of_service values to retain only the first int
    encounters_df["level_of_service"] = encounters_df["level_of_service"].str.extract(
        r"(\d+)"
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
