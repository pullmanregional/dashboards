import sys
import os
import shutil
import re
import logging
import pandas as pd
from datetime import datetime, date
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
    data_df: pd.DataFrame


@dataclass
class OutData:
    data_df: pd.DataFrame


# -------------------------------------------------------
# Constants
# -------------------------------------------------------
# Mapping from provider's short name to key in source data
PROVIDER_TO_ALIAS = {
    "LEE, JONATHAN": "Lee",
    "FROSTAD, MICHAEL": "Mike",
    "GORDON, METHUEL": "Gordon",
    "HRYNIEWICZ, KATHRYN": "Katie",
    "RINALDI, MACKENZIE": "Kenzie",
    "SHIELDS, MARICARMEN": "Shields",
}
PROVIDERS = list(PROVIDER_TO_ALIAS.keys())
# Specific location strings that indicate an inpatient charge
INPT_LOCATIONS = [
    "CC WPL PULLMAN REGIONAL HOSPITAL",
]
# Regex matching outpatient procedure CPT codes
RE_PROCEDURE_CODES = "54150|41010|120[01][1-8]"


# -------------------------------------------------------
# Extract
# -------------------------------------------------------
def read_source_tables(prw_engine) -> SrcData:
    """
    Read source tables from the warehouse DB.
    - Filters to specific providers.
    - Excludes facility charges and charges with no RVUs
    - Limit to charges within the last two years, starting from Jan 1
    """
    logging.info("Reading source tables")

    # Read charges data.
    jan_1_two_years_ago = date(datetime.now().year - 2, 1, 1)

    data_df = pd.read_sql_query(
        """
        SELECT 
            prw_id,
            service_date as date,
            post_date as posted_date,
            billing_provider as provider,
            procedure_code as cpt,
            modifiers,
            quantity,
            procedure_desc as desc,
            wrvu,
            reversal_reason,
            primary_payor_class as insurance_class,
            dept,
            location
        FROM prw_charges 
        WHERE 
            (modifiers NOT LIKE '%FAC%' OR modifiers IS NULL)
            AND (wrvu <> 0 OR wrvu IS NULL)
            AND billing_provider IN ({})
            AND service_date >= ?
        """.format(
            ",".join(["?"] * len(PROVIDERS))
        ),
        con=prw_engine,
        params=tuple([*PROVIDERS, jan_1_two_years_ago]),
        parse_dates=["date", "posted_date"],
    )

    return SrcData(data_df=data_df)


# -------------------------------------------------------
# Transform
# -------------------------------------------------------
def transform(src: SrcData) -> OutData:
    """
    Transform source data into datamart tables. Add calculated columns.
    """
    # Convert provider name to single word alias
    df = src.data_df
    df["provider_alias"] = df.provider.map(PROVIDER_TO_ALIAS)

    # Month (eg. 2022-01) and quarter (eg. 2020-Q01)
    df["month"] = df.date.dt.to_period("M").dt.strftime("%Y-%m")
    df["quarter"] = df.date.dt.to_period("Q").dt.strftime("%Y Q%q")
    df["posted_month"] = df.posted_date.dt.to_period("M").dt.strftime("%Y-%m")
    df["posted_quarter"] = df.posted_date.dt.to_period("Q").dt.strftime("%Y Q%q")

    # Covered by medicaid?
    r_medicaid = re.compile(r"medicaid", re.IGNORECASE)
    df["medicaid"] = df.insurance_class.apply(lambda x: bool(r_medicaid.match(x)))

    # Inpatient?
    r_inpt = re.compile(f"^{'|'.join(INPT_LOCATIONS)}$", re.IGNORECASE)
    df["inpatient"] = df.location.apply(lambda x: bool(r_inpt.match(x)))

    return OutData(data_df=df)


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

    # Calculate key/value data
    kv_data = {}

    # Write tables to datamart
    session = Session(out_engine)
    db_utils.clear_tables_and_insert_data(
        session, [db_utils.TableData(table=db.Charges, df=out.data_df)]
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
    print("Done")


if __name__ == "__main__":
    main()
