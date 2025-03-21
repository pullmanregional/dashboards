import sys, os

# Add project root and repo roots so we can import common modules and from ../src/
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))

import shutil
import json
import logging
import pandas as pd
from datetime import datetime, timedelta
from dataclasses import dataclass
from sqlmodel import Session, select, text, create_engine
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
    new_patients_by_month: pd.DataFrame

    kv: dict


# -------------------------------------------------------
# Extract
# -------------------------------------------------------
def read_source_tables(prw_engine) -> SrcData:
    """
    Read source tables from the warehouse DB
    """
    logging.info("Reading source tables")

    patients_df = pd.read_sql_table("prw_patients", prw_engine, index_col="id")
    patient_panel_df = pd.read_sql_table(
        "prw_patient_panels", prw_engine, index_col="id"
    )
    encounters_df = pd.read_sql_table("prw_encounters", prw_engine, index_col="id")
    return SrcData(
        patients_df=patients_df,
        patient_panel_df=patient_panel_df,
        encounters_df=encounters_df,
    )


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
            f"{int(row['age_in_mo_under_3'])} mo" if row["age"] < 2 else str(row["age"])
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
    patients_df["panel_assignment_rule"] = patients_df["prw_id"].map(
        src.patient_panel_df.set_index("prw_id")["assignment_details"]
        .fillna("")
        .str.split(":", n=1)
        .str[0]
    )

    # Delete unused columns
    patients_df.drop(
        columns=[
            "city",
            "state",
        ],
        inplace=True,
    )

    # Only consider completed encounters
    encounters_df = src.encounters_df[
        src.encounters_df.appt_status == "Completed"
    ].copy()

    # Force date columns to be date only, no time
    encounters_df["encounter_date"] = pd.to_datetime(
        encounters_df["encounter_date"].astype(str), format="%Y%m%d"
    )
    # Map encounter location to clinic IDs
    encounters_df["location"] = encounters_df["dept"].map(CLINIC_IDS)

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

    # Limit to patients and encounters to the last 3 years
    encounters_df = encounters_df[
        encounters_df["encounter_date"] >= (datetime.now() - timedelta(days=1095))
    ]
    patients_df = patients_df[patients_df["prw_id"].isin(encounters_df["prw_id"])]

    # --------------------------------------------------------------------------
    # Filter to only include office visits
    # --------------------------------------------------------------------------
    office_visit_types = [
        "CC OFFICE VISIT",
        "CC FOLLOW UP",
        "CVV VIRTUAL VISIT",
        "CC PROCEDURE",
        "CC OFFICE VISIT (LONG)",
        "CC WELL BABY",
        "CC WELL CHILD",
        "CC OB FOLLOW UP",
        "CVV VIRTUAL VISIT EXTENDED",
        "CC DIABETIC MANAGEMENT",
        "CC NEW PATIENT",
        "CC TELEPHONE VISIT",
        "CC MEDICARE ANNUAL WELLNESS",
        "CC WELLNESS",
        "CC PHYSICAL",
        "CC VASECTOMY",
        "CC POST PARTUM",
        "CC DOT PHYSICAL",
        "CC CIRCUMCISION",
        "CC WELL WOMEN",
        "CC SPORTS PHYSICAL",
        "CC MEDICARE SUB AN WELL",
        "CC PRENATAL",
        "CC SAME DAY",
        "CC OFFSITE CARE",
        "CC MEDICARE WELCOME",
        "CC FAA PHYSICAL",
    ]
    office_visits_df = encounters_df[
        encounters_df["encounter_type"].isin(office_visit_types)
    ]

    # --------------------------------------------------------------------------
    # Calculate monthly new patient volumes
    # --------------------------------------------------------------------------
    # Combine visit counts for Palouse Pediatrics locations and Pullman Family Medicine locations
    peds_locations = ["Palouse Pediatrics Pullman", "Palouse Pediatrics Moscow"]
    pfm_locations = [
        "Pullman Family Medicine",
        "Pullman Family Medicine (Palouse Health Center)",
    ]
    combined_clinic_visits_df = office_visits_df.copy()
    combined_clinic_visits_df["clinic"] = combined_clinic_visits_df["location"].map(
        lambda x: "Palouse Pediatrics" if x in peds_locations else x
    )
    combined_clinic_visits_df = combined_clinic_visits_df.map(
        lambda x: "Pullman Family Medicine" if x in pfm_locations else x
    )

    # Deduplicate visits to one per location per day. Use a key with {id}_{clinic}_{date} to group.
    combined_clinic_visits_df["patient_day"] = (
        combined_clinic_visits_df["prw_id"]
        + "_"
        + combined_clinic_visits_df["clinic"]
        + "_"
        + combined_clinic_visits_df["encounter_date"].dt.strftime("%Y%m%d")
    )
    deduplicated_visits = combined_clinic_visits_df.drop_duplicates(
        subset=["patient_day"]
    )
    deduplicated_visits["year_month"] = deduplicated_visits[
        "encounter_date"
    ].dt.strftime("%Y-%m")

    # Get the first visit date for each patient
    first_visits = (
        deduplicated_visits.sort_values("encounter_date")
        .groupby("prw_id")
        .first()
        .reset_index()
    )

    # Group by clinic and year_month to count new patients
    new_patients_by_month = (
        first_visits.groupby(["clinic", "year_month"])
        .size()
        .reset_index(name="new_count")
    )

    # Count total visits per clinic and month
    total_visits_by_month = (
        deduplicated_visits.groupby(["clinic", "year_month"])
        .size()
        .reset_index(name="total_count")
    )

    # Merge new patient counts with total visit counts
    new_patients_by_month = pd.merge(
        new_patients_by_month,
        total_visits_by_month,
        on=["clinic", "year_month"],
        how="outer",
    ).fillna(0)

    # Add a "Total" row that sums across all clinics for each month
    total_by_month = (
        new_patients_by_month.groupby("year_month")
        .agg({"new_count": "sum", "total_count": "sum"})
        .reset_index()
    )
    total_by_month["clinic"] = "Total"

    # Combine the clinic-specific data with the totals
    new_patients_by_month = pd.concat([new_patients_by_month, total_by_month])

    # Convert count columns to integers
    new_patients_by_month["new_count"] = new_patients_by_month["new_count"].astype(int)
    new_patients_by_month["total_count"] = new_patients_by_month["total_count"].astype(
        int
    )

    # --------------------------------------------------------------------------
    # Get list of unique panel locations and providers per location
    # --------------------------------------------------------------------------
    clinics = [
        clinic
        for clinic in patients_df["panel_location"].unique()
        if clinic is not None
    ]
    providers_by_clinic = {}
    for clinic in clinics:
        panel_providers = patients_df[patients_df["panel_location"] == clinic][
            "panel_provider"
        ].unique()
        # Filter out None values
        providers_by_clinic[clinic] = [
            provider for provider in panel_providers if provider is not None
        ]

    return OutData(
        patients_df=patients_df,
        encounters_df=office_visits_df,
        new_patients_by_month=new_patients_by_month,
        kv={
            "clinics": list(clinics),
            "providers": providers_by_clinic,
        },
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
    encrypt_key = args.key
    tmp_db_file = "datamart.sqlite3"
    tmp_kv_file = "datamart.json"

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
            db_utils.TableData(table=db.NewPatients, df=out.new_patients_by_month),
        ],
    )

    # Update last ingest time and modified times for source data files
    db_utils.write_meta(session, db.Meta)
    session.commit()

    # Write to the output key/value file as JSON
    with open(tmp_kv_file, "w") as f:
        json.dump(out.kv, f, indent=2)

    # Finally encrypt output files, or just copy if no encryption key is provided
    if encrypt_key and encrypt_key.lower() != "none":
        encrypt_file(tmp_db_file, output_db_file, encrypt_key)
        encrypt_file(tmp_kv_file, output_kv_file, encrypt_key)
    else:
        shutil.copy(tmp_db_file, output_db_file)
        shutil.copy(tmp_kv_file, output_kv_file)

    # Clean up tmp files
    os.remove(tmp_db_file)
    os.remove(tmp_kv_file)
    prw_engine.dispose()
    out_engine.dispose()
    print("Done")


if __name__ == "__main__":
    main()
