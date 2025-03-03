# This is the Prefect flow that starts the datamart ingest process and uploads the completed artifacts.
# Remember that this file is run outside of a virtualenv, so the only dependencies available
# are the ones installed in the Prefect worker environment. The virtualenv created by ./Pipfile
# will be available to ./ingest_datamart.py, but not to this Prefect flow.

import os
import sys
from prefect import flow, task
from prefect_shell import ShellOperation
from prefect_aws import AwsCredentials, S3Bucket
from prefect.blocks.system import Secret

# Import common modules from repo root
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
from prw_common.env_utils import load_prw_env

PREFECT_FLOW_NAME = "prw-datamart-sample"

# Load env vars from the .env file corresponding to PRW_ENV (dev/prod)
PRW_ENV = load_prw_env(__file__)

# Load config from env vars into constants
PRW_CONN = os.environ.get("PRW_CONN") or Secret.load("prw-db-url").get()
PRH_SAMPLE_VENV_NAME = os.environ.get("PRH_SAMPLE_VENV_NAME", "")
PRH_SAMPLE_CLOUDFLARE_R2_BUCKET = os.environ.get("PRH_SAMPLE_CLOUDFLARE_R2_BUCKET")
PRH_SAMPLE_DATA_KEY = (
    os.environ.get("PRH_SAMPLE_DATA_KEY") or Secret.load("prh-sample-data-key").get()
)
PRH_SAMPLE_ENCRYPTED_DB_FILE = os.environ.get("PRH_SAMPLE_ENCRYPTED_DB_FILE")
PRH_SAMPLE_ENCRYPTED_JSON_FILE = os.environ.get("PRH_SAMPLE_ENCRYPTED_JSON_FILE")


@task
def upload_files(bucket_name, files):
    """Upload the given files to S3"""
    aws_creds = AwsCredentials.load("cloudflare-r2-dataset")
    s3_bucket = S3Bucket(bucket_name=bucket_name, credentials=aws_creds)
    for file in files:
        s3_bucket.upload_from_path(file, file)
    print("Uploaded to S3:", files)


@flow(
    retries=0,
    name=PREFECT_FLOW_NAME + (f".{PRW_ENV}" if PRW_ENV != "prod" else ""),
)
def prh_datamart_sample():
    # Set working dir to path of this file
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print("Running from:", os.getcwd())

    with ShellOperation(
        commands=[
            "pipenv install",
            f'pipenv run python ingest_datamart.py --prw "{PRW_CONN}" --out "{PRH_SAMPLE_ENCRYPTED_DB_FILE}" --kv "{PRH_SAMPLE_ENCRYPTED_JSON_FILE}" --key "{PRH_SAMPLE_DATA_KEY}"',
        ],
        env={
            "PIPENV_IGNORE_VIRTUALENVS": "1",
            "PIPENV_CUSTOM_VENV_NAME": PRH_SAMPLE_VENV_NAME,
        },
        stream_output=True,
    ) as op:
        proc = op.trigger()
        proc.wait_for_completion()
        if proc.return_code != 0:
            raise Exception(f"Failed, exit code {proc.return_code}")

    # Upload encrypted output to S3
    if PRH_SAMPLE_CLOUDFLARE_R2_BUCKET:
        upload_files(
            PRH_SAMPLE_CLOUDFLARE_R2_BUCKET,
            [PRH_SAMPLE_ENCRYPTED_DB_FILE, PRH_SAMPLE_ENCRYPTED_JSON_FILE],
        )


if __name__ == "__main__":
    prh_datamart_sample()
