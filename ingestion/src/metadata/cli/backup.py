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
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

import click
from sqlalchemy.engine import Engine

from metadata.cli.db_dump import dump
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.utils.connections import get_connection
from metadata.utils.helpers import list_to_dict
from metadata.utils.logger import cli_logger

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


def upload_backup(endpoint: str, bucket: str, key: str, file: Path) -> None:
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
        import boto3
        from boto3.exceptions import S3UploadFailedError
    except ModuleNotFoundError as err:
        logger.error(
            "Trying to import boto3 to run the backup upload."
            + " Please install openmetadata-ingestion[backup]."
        )
        raise err

    s3_key = Path(key) / file.name
    click.secho(
        f"Uploading {file} to {endpoint}/{bucket}/{str(s3_key)}...",
        fg="bright_green",
    )

    try:
        resource = boto3.resource(service_name="s3", endpoint_url=endpoint)
        resource.Object(bucket, str(s3_key)).upload_file(str(file.absolute()))

    except ValueError as err:
        logger.error("Revisit the values of --upload")
        raise err
    except S3UploadFailedError as err:
        logger.error(
            "Error when uploading the backup to S3. Revisit the config and permissions."
            + " You should have set the environment values for AWS_ACCESS_KEY_ID"
            + " and AWS_SECRET_ACCESS_KEY"
        )
        raise err


def run_backup(
    host: str,
    user: str,
    password: str,
    database: str,
    port: str,
    output: Optional[str],
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
    click.secho(
        f"Creating OpenMetadata backup for {host}:{port}/{database}...",
        fg="bright_green",
    )

    out = get_output(output)

    connection_options = list_to_dict(options)
    connection_arguments = list_to_dict(arguments)

    connection_dict = {
        "hostPort": f"{host}:{port}",
        "username": user,
        "password": password,
        "connectionOptions": connection_options if connection_options else None,
        "connectionArguments": connection_arguments if connection_arguments else None,
    }

    if not schema:
        connection_dict["databaseSchema"] = database
        connection = MysqlConnection(**connection_dict)
    else:
        connection_dict["database"] = database
        connection = PostgresConnection(**connection_dict)

    engine: Engine = get_connection(connection)

    dump(engine=engine, output=out, schema=schema)

    click.secho(
        f"Backup stored locally under {out}",
        fg="bright_green",
    )

    if upload:
        endpoint, bucket, key = upload
        upload_backup(endpoint, bucket, key, out)
