#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import subprocess
from time import monotonic, sleep
from typing import ClassVar

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

DB_VERSION = "2025.1.8"
DB_PORT = 8563
CONTAINER_SUFFIX = "exasolquery"
CONTAINER_NAME = f"db_container_{CONTAINER_SUFFIX}"
DOCKER_IMAGE = f"exasol/docker-db:{DB_VERSION}"
DOCKER_PULL_ATTEMPTS = 3
DOCKER_PULL_RETRY_SECONDS = 10
SCHEMA_NAME = "OPENMETADATA_QUERY_TEST"
TABLE_NAME = "DATATYPES"
SIMILAR_TABLE_NAME = f"{TABLE_NAME}_EXTRA"
VIEW_NAME = f"VIEW_{TABLE_NAME}"


def wait_for_system_table(
    engine: Engine,
    query: str,
    expected_count: int,
    params: dict[str, object] | None = None,
    timeout_seconds: int = 120,
    interval_seconds: int = 5,
) -> list[dict[str, object]]:
    """Poll the query until the expected rows are visible and return them."""
    deadline = monotonic() + timeout_seconds
    last_rows: list[dict[str, object]] = []

    while monotonic() < deadline:
        with engine.begin() as connection:
            connection.execute(text("FLUSH STATISTICS"))
            rows = connection.execute(text(query), params or {}).mappings().all()

        last_rows = list(rows)
        if len(last_rows) >= expected_count:
            return last_rows

        sleep(interval_seconds)

    raise AssertionError(
        f"Timed out after {timeout_seconds}s waiting for {expected_count} rows. "
        f"Last observed row count: {len(last_rows)}"
    )


def _prepare_exasol_objects(engine: Engine) -> None:
    setup_statements = [
        f"CREATE SCHEMA IF NOT EXISTS {SCHEMA_NAME}",
        f"DROP TABLE IF EXISTS {SCHEMA_NAME}.{TABLE_NAME}",
        f"DROP TABLE IF EXISTS {SCHEMA_NAME}.{SIMILAR_TABLE_NAME}",
        f"DROP VIEW IF EXISTS {SCHEMA_NAME}.{VIEW_NAME}",
        f"""
                CREATE TABLE {SCHEMA_NAME}.{TABLE_NAME} (
                    col_boolean BOOLEAN,
                    col_decimal DOUBLE PRECISION,
                    col_date DATE,
                    col_timestamp TIMESTAMP,
                    col_timestamp_local TIMESTAMP WITH LOCAL TIME ZONE,
                    col_char CHAR(1),
                    col_varchar VARCHAR(1)
                )
                """,
        f"""
                CREATE VIEW {SCHEMA_NAME}.{VIEW_NAME} AS
                SELECT
                    col_boolean,
                    col_decimal,
                    col_date,
                    col_timestamp,
                    col_timestamp_local,
                    col_char,
                    col_varchar
                FROM {SCHEMA_NAME}.{TABLE_NAME}
                """,
        f"""
                CREATE TABLE {SCHEMA_NAME}.{SIMILAR_TABLE_NAME} (
                    col_boolean BOOLEAN,
                    col_decimal DOUBLE PRECISION,
                    col_date DATE,
                    col_timestamp TIMESTAMP,
                    col_timestamp_local TIMESTAMP WITH LOCAL TIME ZONE,
                    col_char CHAR(1),
                    col_varchar VARCHAR(1)
                )
                """,
    ]
    with engine.begin() as connection:
        for statement in setup_statements:
            connection.execute(text(statement))


def _ensure_exasol_image() -> None:
    image_inspect = subprocess.run(
        ["docker", "image", "inspect", DOCKER_IMAGE],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if image_inspect.returncode == 0:
        return

    for attempt in range(1, DOCKER_PULL_ATTEMPTS + 1):
        pull_result = subprocess.run(["docker", "pull", DOCKER_IMAGE], check=False)
        if pull_result.returncode == 0:
            return
        if attempt == DOCKER_PULL_ATTEMPTS:
            pull_result.check_returncode()
        sleep(DOCKER_PULL_RETRY_SECONDS)


class ExasolTestBase:
    engine: ClassVar[Engine]

    @classmethod
    def setup_class(cls):
        _ensure_exasol_image()
        subprocess.run(
            [
                "itde",
                "spawn-test-environment",
                "--environment-name",
                CONTAINER_SUFFIX,
                "--database-port-forward",
                f"{DB_PORT}",
                "--bucketfs-port-forward",
                "2580",
                "--docker-db-image-version",
                DB_VERSION,
                "--db-mem-size",
                "4GB",
            ],
            check=True,
        )

        cls.engine = create_engine(f"exa+websocket://sys:exasol@localhost:{DB_PORT}/?SSLCertificate=SSL_VERIFY_NONE")
        _prepare_exasol_objects(cls.engine)

    @classmethod
    def teardown_class(cls):
        cls.engine.dispose()
        subprocess.run(["docker", "kill", CONTAINER_NAME], check=True, encoding="utf-8")
