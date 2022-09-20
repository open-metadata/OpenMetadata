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
Restore utility for the metadata CLI
"""
from pathlib import Path
from typing import List, Optional, Tuple

import click
from sqlalchemy import create_engine, inspect, text
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


def execute_query(engine: Engine, input: Path, schema: str = None) -> None:
    import textwrap

    with engine.connect() as con:
        with open(input) as file:
            for query in file:
                print((text(query)))
                con.execute(textwrap.dedent(f"""{text(query)}"""))


def run_restore(
    host: str,
    user: str,
    password: str,
    database: str,
    port: str,
    input: str,
    download: Optional[Tuple[str, str, str]],
    options: List[str],
    arguments: List[str],
    schema: Optional[str] = None,
) -> None:
    """
    Run and restore the
    buckup. Optionally, download it from S3.

    :param host: service host
    :param user: service user
    :param password: service pwd
    :param database: database to back up
    :param port: database service port
    :param intput: local path of file to restore the backup
    :param dwonloadload: URI to download result file
    :param options: list of other connection options
    :param arguments: list of connection arguments
    :param schema: Run the process against Postgres with the given schema
    """
    click.secho(
        f"Restoring OpenMetadata backup for {host}:{port}/{database}...",
        fg="bright_green",
    )

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

    execute_query(engine=engine, input=input, schema=schema)

    click.secho(
        f"Backup restored from {input}",
        fg="bright_green",
    )
