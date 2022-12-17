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
from typing import Optional, Tuple

from metadata.cli.db_dump import dump
from metadata.cli.utils import get_engine
from metadata.utils.ansi import ANSI, print_ansi_encoded_string
from metadata.utils.helpers import BackupRestoreArgs
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
    print_ansi_encoded_string(
        color=ANSI.GREEN,
        bold=False,
        message=f"Uploading {file} to {endpoint}/{bucket}/{str(s3_key)}...",
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

    print_ansi_encoded_string(
        color=ANSI.GREEN,
        message=f"Uploading {file} to {account_url}/{container}...",
    )

    try:
        # Create a blob client using the local file name as the name for the blob
        blob_client = blob_service_client.get_blob_client(
            container=container, blob=file.name
        )

        # Upload the created file
        with open(file=file, mode="rb") as data:
            blob_client.upload_blob(data)

    except ValueError as err:
        logger.debug(traceback.format_exc())
        logger.error("Revisit the values of --upload")
        raise err
    except Exception as err:
        logger.debug(traceback.format_exc())
        logger.error(err)
        raise err


def run_backup(
    common_backup_obj_instance: BackupRestoreArgs,
    output: Optional[str],
    upload_destination_type: Optional[UploadDestinationType],
    upload: Optional[Tuple[str, str, str]],
) -> None:
    """
    Run `mysqldump` to MySQL database and store the
    output. Optionally, upload it to S3.

    :param common_backup_obj_instance: cls instance to fetch common args
    :param output: local path to store the backup
    :param upload_destination_type: Azure or AWS Destination Type
    :param upload: URI to upload result file

    """
    print_ansi_encoded_string(
        color=ANSI.GREEN,
        bold=False,
        message="Creating OpenMetadata backup for "
        f"{common_backup_obj_instance.host}:{common_backup_obj_instance.port}/{common_backup_obj_instance.database}...",
    )

    out = get_output(output)

    engine = get_engine(common_args=common_backup_obj_instance)
    dump(engine=engine, output=out, schema=common_backup_obj_instance.schema)

    print_ansi_encoded_string(
        color=ANSI.GREEN, bold=False, message=f"Backup stored locally under {out}"
    )

    if upload:
        if upload_destination_type == UploadDestinationType.AWS.value:
            endpoint, bucket, key = upload
            upload_backup_aws(endpoint, bucket, key, out)
        elif upload_destination_type.title() == UploadDestinationType.AZURE.value:
            # only need two parameters from upload, key would be null
            account_url, container, key = upload
            upload_backup_azure(account_url, container, out)
