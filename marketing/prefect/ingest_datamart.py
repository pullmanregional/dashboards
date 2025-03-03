import sys
import os
import shutil
import argparse
import json
import pandas as pd
from sqlalchemy import create_engine, select, text
from cryptography.fernet import Fernet
from prefect.blocks.system import Secret

# Add project root and repo roots so we can import common modules and from ../src/
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
from src.model import Base
from prw_common.cli_utils import cli_parser
from prw_common.encrypt import encrypt_file


def parse_arguments():
    parser = cli_parser(
        description="Ingest data from PRW warehouse to datamart.",
        require_prw=True,
        require_out=True
    )
    parser.add_argument("--kv", help="Output key/value data file path", required=True)
    parser.add_argument("--key", help="Encrypt with given key. Defaults to no encryption if not specified.")
    return parser.parse_args()


def main():
    args = parse_arguments()
    prw_db_url = args.prw
    output_db_file = args.out
    output_kv_file = args.kv
    encrypt_key = args.key
    tmp_db_file = "datamart.sqlite3"
    tmp_kv_file = "datamart.json"

    # Create the sqlite output database and create the tables as defined in ../src/model.py
    db_engine = create_engine(f"sqlite:///{tmp_db_file}")
    Base.metadata.create_all(db_engine)

    # Read from PRW warehouse (MSSQL in prod, sqlite in dev)
    prw_engine = create_engine(prw_db_url)

    # Write to the output key/value file as JSON
    kv_data = {}
    with open(tmp_kv_file, "w") as f:
        json.dump(kv_data, f)

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
    


if __name__ == "__main__":
    main()
