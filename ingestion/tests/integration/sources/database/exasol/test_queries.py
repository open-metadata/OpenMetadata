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

from sqlalchemy import text

from ingestion.tests.integration.sources.database.exasol.base import (
    SCHEMA_NAME,
    SIMILAR_TABLE_NAME,
    TABLE_NAME,
    ExasolTestBase,
    wait_for_system_table,
)
from metadata.ingestion.source.database.exasol.queries import (
    EXASOL_SQL_STATEMENT,
    EXASOL_SYSTEM_METRICS_QUERY,
    EXASOL_TEST_GET_QUERIES,
)


class TestExasolQueries(ExasolTestBase):
    def test_connection_test_get_queries(self):
        query = EXASOL_TEST_GET_QUERIES
        rows = wait_for_system_table(self.engine, query, expected_count=1, timeout_seconds=120)
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

        rows = wait_for_system_table(self.engine, query, expected_count=5, timeout_seconds=120)
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

    def test_system_metrics_query_ignores_similarly_named_tables(self):
        seed_rows = [
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
                INSERT INTO {SCHEMA_NAME}.{SIMILAR_TABLE_NAME} (
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
        ]

        with self.engine.begin() as connection:
            for statement in seed_rows:
                connection.execute(text(statement))

        dml_statements = [
            f"""
                DELETE FROM {SCHEMA_NAME}.{TABLE_NAME}
                WHERE col_char = 'x'
                """,
            f"""
                DELETE FROM {SCHEMA_NAME}.{SIMILAR_TABLE_NAME}
                WHERE col_char = 'x'
                """,
        ]
        with self.engine.begin() as connection:
            for statement in dml_statements:
                connection.execute(text(statement))

        target_params = {
            "database_name": "default",
            "schema": SCHEMA_NAME,
            "table": TABLE_NAME,
            "operation": "DELETE",
            "table_match_pattern": rf"(?s).*\b{SCHEMA_NAME}\.{TABLE_NAME}\b.*",
        }

        rows = wait_for_system_table(
            self.engine,
            EXASOL_SYSTEM_METRICS_QUERY,
            expected_count=1,
            params=target_params,
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
