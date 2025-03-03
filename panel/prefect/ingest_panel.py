# Add main repo directory to include path to access common/ modules
import sys, pathlib

sys.path.append(str(pathlib.Path(__file__).parent.parent.parent))

import os
import logging
import argparse
import pandas as pd
from dataclasses import dataclass
from sqlmodel import Session
from dotenv import load_dotenv
from sqlmodel import SQLModel, Session
from model import panel_model

# Add project root and repo roots so we can import common modules and from ../src/
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
from prw_common import db_utils


# -------------------------------------------------------
# Config
# -------------------------------------------------------
# Load environment from .env file, does not overwrite existing env variables
load_dotenv()

# Load security sensitive config from env vars. Default output to local SQLite DB.
PRW_CONN = os.environ.get("PRW_CONN", "sqlite:///prw.sqlite3")
PANEL_DB_ODBC = os.environ.get("PANEL_DB_ODBC", "sqlite:///panel.sqlite3")


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
def read_source_tables(engine) -> SrcData:
    """
    Read source tables from the warehouse DB
    """
    logging.info("Reading source tables")
    with Session(engine) as session:
        patients_df = pd.read_sql_table("prw_patients", session.bind)
        encounters_df = pd.read_sql_table("prw_encounters", session.bind)

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
    Transform source data into panel data
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
# Utilities
# -------------------------------------------------------
def error_exit(msg):
    logging.error(msg)
    exit(1)


# -------------------------------------------------------
# Main entry point
# -------------------------------------------------------
def parse_arguments():
    parser = argparse.ArgumentParser(description="Ingest raw data into PRH warehouse.")
    parser.add_argument(
        "-i",
        "--input",
        help='Connnection string to warehouse database, including credentials. Look for Azure SQL connection string in Settings > Connection strings, eg. "mssql+pyodbc:///?odbc_connect=Driver={ODBC Driver 18 for SQL Server};Server=tcp:{your server name},1433;Database={your db name};Uid={your user};Pwd={your password};Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"',
        default=PRW_CONN,
    )
    parser.add_argument(
        "-o",
        "--output",
        help="Output DB connection string, including credentials",
        default=PANEL_DB_ODBC,
    )
    return parser.parse_args()


def main():
    # Logging configuration
    logging.basicConfig(level=logging.INFO)

    # Load config from cmd line
    args = parse_arguments()
    input_odbc = args.input
    output_odbc = args.output
    logging.info(f"Input: {input_odbc}, output: {db_utils.mask_pw(output_odbc)}")

    # Get connection to input DB
    in_engine = db_utils.get_db_connection(input_odbc)
    if in_engine is None:
        error_exit("ERROR: cannot open warehouse DB (see above)")

    # Extract source tables into memory
    src = read_source_tables(in_engine)
    if src is None:
        error_exit("ERROR: failed to read source data (see above)")

    # Transform data
    out = transform(src)

    # Get connection to output DB
    out_engine = db_utils.get_db_connection(output_odbc)
    if out_engine is None:
        error_exit("ERROR: cannot open output DB (see above)")

    # Create tables if they do not exist
    SQLModel.metadata.create_all(out_engine)

    # Write into DB
    session = Session(out_engine)
    db_utils.clear_tables_and_insert_data(
        session,
        [
            db_utils.TableData(table=panel_model.Patient, df=out.patients_df),
            db_utils.TableData(table=panel_model.Encounter, df=out.encounters_df),
        ],
    )

    # Update last ingest time and modified times for source data files
    db_utils.write_meta(session, panel_model.Meta)
    session.commit()

    # Cleanup
    in_engine.dispose()
    out_engine.dispose()
    logging.info("Done")


if __name__ == "__main__":
    main()
