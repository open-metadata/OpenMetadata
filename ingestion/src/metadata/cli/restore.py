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
from typing import List, Optional

import click
from sqlalchemy.engine import Engine

from metadata.cli.utils import get_engine
from metadata.utils.logger import cli_logger

logger = cli_logger()


def execute_sql_file(engine: Engine, sql_file: str) -> None:
    """
    Method to create the connection and execute the sql query
    """

    with open(sql_file, encoding="utf-8") as file:
        for query in file.readlines():
            # `%` is a reserved syntax in SQLAlchemy to bind parameters. Escaping it with `%%`
            clean_query = query.replace("%", "%%")

            with engine.connect() as conn:
                conn.execute(clean_query)


def run_restore(  # pylint: disable=too-many-arguments
    host: str,
    user: str,
    password: str,
    database: str,
    port: str,
    sql_file: str,
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
    :param sql_file: local path of file to restore the backup
    :param options: list of other connection options
    :param arguments: list of connection arguments
    :param schema: Run the process against Postgres with the given schema
    """
    click.secho(
        f"Restoring OpenMetadata backup for {host}:{port}/{database}...",
        fg="bright_green",
    )

    engine = get_engine(
        host, port, user, password, options, arguments, schema, database
    )

    execute_sql_file(engine=engine, sql_file=sql_file)

    click.secho(
        f"Backup restored from {sql_file}",
        fg="bright_green",
    )
