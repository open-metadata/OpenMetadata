#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Backup utility for the metadata CLI
"""
import traceback
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import List, Optional, Tuple

from metadata.cli.db_dump import dump
from metadata.cli.utils import get_engine
from metadata.utils.constants import UTF_8
from metadata.utils.ansi import ANSI
from metadata.utils.logger import cli_logger


class UploadDestinationType(Enum):
    AWS = "AWS"
    AZURE = "Azure"


logger = cli_logger()


def get_output(output: Optional[str] = None) -> Path:
    """
    Helper function to prepare the output backup file
    path and name.

    It will create the output dir if it does not exist.

    :param output: local path to store the backup
    :return: backup file name
    """
    now = datetime.now().strftime("%Y%m%d%H%M")
    name = f"openmetadata_{now}_backup.sql"

    if output:
        # Create the output directory if it does not exist
        if not Path(output).is_dir():
            Path(output).mkdir(parents=True, exist_ok=True)

        return Path(output) / name

    return Path(name)


def upload_backup_aws(endpoint: str, bucket: str, key: str, file: Path) -> None:
    """
    Upload the mysqldump backup file.
    We will use boto3 to upload the file to the endpoint
    and the key provided.

    :param endpoint: S3 endpoint
    :param bucket: S3 bucket to upload the file to
    :param key: S3 key to upload the backup file
    :param file: file to upload
    """

    try:
        # We just want to force boto3 install if uploading backup
        # pylint: disable=import-outside-toplevel
        import boto3
        from boto3.exceptions import S3UploadFailedError
    except ModuleNotFoundError as err:
        logger.debug(traceback.format_exc())
        logger.error(
            "Trying to import boto3 to run the backup upload."
            + " Please install openmetadata-ingestion[backup]."
        )
        raise err

    s3_key = Path(key) / file.name
    print(
        f"{ANSI.GREEN.value}Uploading {file} to {endpoint}/{bucket}/{str(s3_key)}... {ANSI.ENDC.value}"
    )

    try:
        resource = boto3.resource(service_name="s3", endpoint_url=endpoint)
        resource.Object(bucket, str(s3_key)).upload_file(str(file.absolute()))

    except ValueError as err:
        logger.debug(traceback.format_exc())
        logger.error("Revisit the values of --upload")
        raise err
    except S3UploadFailedError as err:
        logger.debug(traceback.format_exc())
        logger.error(
            "Error when uploading the backup to S3. Revisit the config and permissions."
            + " You should have set the environment values for AWS_ACCESS_KEY_ID"
            + " and AWS_SECRET_ACCESS_KEY"
        )
        raise err


def upload_backup_azure(account_url: str, container: str, file: Path) -> None:
    """
    Upload the mysqldump backup file.

    :param account_url: Azure account url
    :param container: Azure container to upload file to
    :param file: file to upload
    """

    try:
        # pylint: disable=import-outside-toplevel
        from azure.identity import DefaultAzureCredential
        from azure.storage.blob import BlobServiceClient

        default_credential = DefaultAzureCredential()
        # Create the BlobServiceClient object
        blob_service_client = BlobServiceClient(
            account_url, credential=default_credential
        )
    except ModuleNotFoundError as err:
        logger.debug(traceback.format_exc())
        logger.error(
            "Trying to import DefaultAzureCredential to run the backup upload."
        )
        raise err

    click.secho(
        f"Uploading {file} to {account_url}/{container}...",
        fg="bright_green",
    )

    try:
        # Create a blob client using the local file name as the name for the blob
        blob_client = blob_service_client.get_blob_client(
            container=container, blob=file.name
        )

        # Upload the created file
        with open(file=file.absolute, mode="rb", encoding=UTF_8) as data:
            blob_client.upload_blob(data)

    except ValueError as err:
        logger.debug(traceback.format_exc())
        logger.error("Revisit the values of --upload")
        raise err
    except Exception as err:
        logger.debug(traceback.format_exc())
        logger.error(err)
        raise err


def run_backup(  # pylint: disable=too-many-arguments, too-many-locals
    host: str,
    user: str,
    password: str,
    database: str,
    port: str,
    output: Optional[str],
    upload_destination_type: Optional[UploadDestinationType],
    upload: Optional[Tuple[str, str, str]],
    options: List[str],
    arguments: List[str],
    schema: Optional[str] = None,
) -> None:
    """
    Run `mysqldump` to MySQL database and store the
    output. Optionally, upload it to S3.

    :param host: service host
    :param user: service user
    :param password: service pwd
    :param database: database to back up
    :param port: database service port
    :param output: local path to store the backup
    :param upload: URI to upload result file
    :param options: list of other connection options
    :param arguments: list of connection arguments
    :param schema: Run the process against Postgres with the given schema
    """
    print(
        f"{ANSI.GREEN.value}Creating OpenMetadata backup for {host}:{port}/{database}... {ANSI.ENDC.value}"
    )

    out = get_output(output)

    engine = get_engine(
        host, port, user, password, options, arguments, schema, database
    )
    dump(engine=engine, output=out, schema=schema)

    print(f"{ANSI.GREEN.value}Backup stored locally under {out} {ANSI.ENDC.value}")

    if upload:
        if upload_destination_type == UploadDestinationType.AWS.value:
            endpoint, bucket, key = upload
            upload_backup_aws(endpoint, bucket, key, out)
        elif upload_destination_type == UploadDestinationType.AZURE.value:
            # only need two parameters from upload, key would be null
            account_url, container, key = upload
            upload_backup_azure(account_url, container, out)
