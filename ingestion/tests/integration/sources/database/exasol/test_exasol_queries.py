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

from metadata.ingestion.source.database.exasol.queries import (
    EXASOL_GET_COLUMN_COMMENTS,
    EXASOL_GET_TABLE_COMMENTS,
    EXASOL_SQL_STATEMENT,
    EXASOL_SYSTEM_METRICS_QUERY,
    EXASOL_TEST_GET_QUERIES,
)

DB_VERSION = "2025.1.8"
DB_PORT = 8563
CONTAINER_SUFFIX = "exasolquery"
CONTAINER_NAME = f"db_container_{CONTAINER_SUFFIX}"
SCHEMA_NAME = "OPENMETADATA_QUERY_TEST"
TABLE_NAME = "DATATYPES"
VIEW_NAME = f"VIEW_{TABLE_NAME}"


def wait_for_system_table(
    engine: Engine,
    query: str,
    expected_count: int,
    params: dict[str, object] | None = None,
    timeout_seconds: int = 60,
    interval_seconds: int = 5,
) -> list[dict[str, object]]:
    """Poll the query until the expected rows are visible and return them."""
    deadline = monotonic() + timeout_seconds
    last_rows: list[dict[str, object]] = []

    while monotonic() < deadline:
        with engine.connect() as connection:
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
    ]
    with engine.begin() as connection:
        for statement in setup_statements:
            connection.execute(text(statement))


class TestExasolQueries:
    engine: ClassVar[Engine]

    @classmethod
    def setup_class(cls):
        subprocess.run(["docker", "pull", f"exasol/docker-db:{DB_VERSION}"], check=True)
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

    def test_get_table_comments_query(self):
        table_comment = "OpenMetadata Exasol query integration table"
        with self.engine.begin() as connection:
            connection.execute(text(f"COMMENT ON TABLE {SCHEMA_NAME}.{TABLE_NAME} IS '{table_comment}'"))

        with self.engine.connect() as connection:
            rows = connection.execute(text(EXASOL_GET_TABLE_COMMENTS)).mappings().all()

        table_rows = [row for row in rows if row["schema"] == SCHEMA_NAME and row["table_name"] == TABLE_NAME]
        assert table_rows == [
            {
                "schema": SCHEMA_NAME,
                "table_name": TABLE_NAME,
                "table_comment": table_comment,
            }
        ]

    def test_get_column_comments_query(self):
        column_comment = "OpenMetadata Exasol query integration column"
        with self.engine.begin() as connection:
            connection.execute(text(f"COMMENT ON COLUMN {SCHEMA_NAME}.{TABLE_NAME}.col_boolean IS '{column_comment}'"))

        with self.engine.connect() as connection:
            rows = (
                connection.execute(
                    text(EXASOL_GET_COLUMN_COMMENTS),
                    {
                        "schema": SCHEMA_NAME,
                        "table_name": TABLE_NAME,
                    },
                )
                .mappings()
                .all()
            )

        column_rows = [row for row in rows if row["column_name"] == "COL_BOOLEAN"]
        assert column_rows == [
            {
                "schema": SCHEMA_NAME,
                "table_name": TABLE_NAME,
                "column_name": "COL_BOOLEAN",
                "comment": column_comment,
            }
        ]

    def test_connection_test_get_queries(self):
        query = EXASOL_TEST_GET_QUERIES
        rows = wait_for_system_table(self.engine, query, expected_count=1)
        columns = {column.lower() for column in rows[0]}

        assert columns == {
            "sql_text",
            "command_name",
            "user_name",
            "start_time",
            "stop_time",
            "duration",
        }
        assert len(rows) == 1

    def test_sql_statement_query(self):
        query = EXASOL_SQL_STATEMENT.format(
            start_time="2000-01-01 00:00:00",
            end_time="2999-01-01 00:00:00",
            filters="",
            result_limit=5,
        )

        rows = wait_for_system_table(self.engine, query, expected_count=5)
        columns = {column.lower() for column in rows[0]}

        assert columns == {
            "query_text",
            "query_type",
            "user_name",
            "start_time",
            "end_time",
            "duration",
        }
        assert len(rows) == 5

    def test_system_metrics_query_returns_exasol_dml_rows(self):
        dml_statements = [
            f"""
                INSERT INTO {SCHEMA_NAME}.{TABLE_NAME} (
                    col_boolean,
                    col_decimal,
                    col_date,
                    col_timestamp,
                    col_timestamp_local,
                    col_char,
                    col_varchar
                ) VALUES
                (TRUE, 1.5, '2023-07-13', '2023-07-13 06:04:45', '2023-07-13 04:04:45', 'x', 'y')
                """,
            f"""
                UPDATE {SCHEMA_NAME}.{TABLE_NAME}
                SET col_varchar = 'z'
                WHERE col_char = 'x'
                """,
            f"""
                DELETE FROM {SCHEMA_NAME}.{TABLE_NAME}
                WHERE col_char = 'x'
                """,
        ]

        with self.engine.begin() as connection:
            for statement in dml_statements:
                connection.execute(text(statement))

        rows = wait_for_system_table(
            self.engine,
            EXASOL_SYSTEM_METRICS_QUERY,
            expected_count=1,
            params={
                "database_name": "default",
                "schema": SCHEMA_NAME,
                "table": TABLE_NAME,
                "operation": "DELETE",
                "table_match_pattern": f"%{SCHEMA_NAME}.{TABLE_NAME}%",
            },
            timeout_seconds=120,
        )
        columns = {column.lower() for column in rows[0]}

        assert columns == {
            "database",
            "schema",
            "table",
            "starttime",
            "rows",
        }
        assert len(rows) == 1
