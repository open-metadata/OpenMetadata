#  Copyright 2022 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Test Exasol connector with CLI
"""

import subprocess
import time
from typing import List  # noqa: UP035

import pytest
import yaml
from sqlalchemy import text

from ingestion.tests.integration.sources.database.exasol.base import wait_for_system_table
from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.api.status import Status
from metadata.ingestion.source.database.exasol.queries import EXASOL_SQL_STATEMENT
from metadata.ingestion.source.database.exasol.usage import ExasolUsageSource

from .base.config_builders.builders import BaseBuilder  # noqa: TID252
from .base.e2e_types import E2EType  # noqa: TID252
from .common.test_cli_db import CliCommonDB  # noqa: TID252
from .common_e2e_sqa_mixins import SQACommonMethods  # noqa: TID252

SERVICE_NAME = "local_exasol"
SCHEMA_NAME = "openmetadata_schema"
TABLE_NAME = "datatypes"
VIEW_NAME = f"view_{TABLE_NAME}"
JOIN_TABLE_NAME = "IGNORE_TABLE"
TABLE_COMMENT = "OpenMetadata Exasol CLI table comment"
COLUMN_COMMENT = "OpenMetadata Exasol CLI column comment"
DB_PORT = 8563
# The compressed size of this image is 3.23 GB, so it takes on the order of minutes
# to pull it.
DB_VERSION = "2025.1.8"
CONTAINER_SUFFIX = "exasoaddl"
CONTAINER_NAME = f"db_container_{CONTAINER_SUFFIX}"


class UsageConfigBuilder(BaseBuilder):
    """Builder class for database usage config."""

    def __init__(self, config: dict, config_args: dict | None = None) -> None:
        super().__init__(config, config_args)
        self.source = self.config_args.get("source", f"{self.config['source']['type']}-usage")
        self.query_log_duration = self.config_args.get("queryLogDuration", 1)
        self.result_limit = self.config_args.get("resultLimit", 10000)
        self.filename = self.config_args.get("filename", "/tmp/exasol_usage")

    def build(self) -> dict:
        self.config["source"]["type"] = self.source
        self.config["source"]["sourceConfig"] = {
            "config": {
                "type": "DatabaseUsage",
                "queryLogDuration": self.query_log_duration,
                "resultLimit": self.result_limit,
            }
        }
        self.config["processor"] = {"type": "query-parser", "config": {}}
        self.config["stage"] = {"type": "table-usage", "config": {"filename": self.filename}}
        self.config["bulkSink"] = {"type": "metadata-usage", "config": {"filename": self.filename}}
        return self.config


class ExasolCliTest(CliCommonDB.TestSuite, SQACommonMethods):
    """
    Exasol CLI Tests
    """

    create_table_query: str = f"""
        CREATE TABLE IF NOT EXISTS {SCHEMA_NAME}.{TABLE_NAME} (
            col_boolean BOOLEAN,
            col_decimal DOUBLE PRECISION,
            col_date DATE,
            col_timestamp TIMESTAMP,
            col_char CHAR(1),
            col_varchar VARCHAR(1)
        );
    """

    comment_column_query: str = f"""
        COMMENT ON COLUMN {SCHEMA_NAME}.{TABLE_NAME}.col_boolean IS '{COLUMN_COMMENT}';
    """

    comment_table_query: str = f"""
        COMMENT ON TABLE {SCHEMA_NAME}.{TABLE_NAME} IS '{TABLE_COMMENT}';
    """

    create_view_query: str = f"""
        CREATE VIEW {SCHEMA_NAME}.{VIEW_NAME} AS
        SELECT
            col_boolean,
            col_decimal,
            col_date,
            col_timestamp,
            col_char,
            col_varchar
        FROM {SCHEMA_NAME}.{TABLE_NAME}
    """

    join_usage_query: str = f"""
        SELECT
            table_source.col_boolean,
            join_source.col_varchar
        FROM {SCHEMA_NAME}.{TABLE_NAME} AS table_source
        JOIN {SCHEMA_NAME}.{JOIN_TABLE_NAME} AS join_source
            ON table_source.col_boolean = join_source.col_boolean
    """

    insert_data_queries: List[str] = [  # noqa: RUF012, UP006
        f"""
            INSERT INTO {SCHEMA_NAME}.{TABLE_NAME} (col_boolean, col_decimal, col_date, col_timestamp, col_char, col_varchar) VALUES
            (TRUE, 18.5, '2023-07-13', '2023-07-13 06:04:45', 'a', 'b');
        """,
        f"""
            INSERT INTO {SCHEMA_NAME}.{TABLE_NAME} (col_boolean, col_decimal, col_date, col_timestamp, col_char, col_varchar) VALUES
            (TRUE, -18.5, '2023-09-13', '2023-09-13 06:04:45', 'c', 'd');
        """,
    ]

    drop_table_query: str = f"""
        DROP TABLE IF EXISTS {SCHEMA_NAME}.{TABLE_NAME};
    """

    drop_view_query: str = f"""
        DROP VIEW IF EXISTS {SCHEMA_NAME}.{VIEW_NAME};
    """

    @classmethod
    def setUpClass(cls):
        """
        To run the Exasol tests, we use the Integration Test Docker Environment (ITDE)
        package. By default, this pulls an Exasol Database Docker image of the
        requested version. However, to reduce confusion and make it clearer what is
        leading to an issue, we have added to the setup that the Docker image is pulled
        first and in a separate command.

        The ITDE includes configuration files for each Exasol Database Docker image.
        Thus, there is unfortunately a tight coupling between the ITDE version
        you are using and the Docker image you can use. Over time, Exasol may drop
        support of certain Docker images, like the one used in this test, if the
        tests break and assistance is needed due to that, please reach out to us at
        opensource@exasol.com or open an issue in the ITDE at
        https://github.com/exasol/integration-test-docker-environment.
        For example, a mismatch in ITDE and Docker image would lead to an error like
        this when the "itde spawn-test-environment" were run:
           FileNotFoundError: [Errno 2] No such file or directory:
           '$HOME/OpenMetadata/venv/lib/python3.11/site-packages/exasol_integration_test_docker_environment/docker_db_config/2025.2.1/init_db.sh'
        """

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
        super().setUpClass()
        with cls.engine.connect() as connection:
            connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA_NAME}"))
            connection.execute(text("CREATE SCHEMA IF NOT EXISTS IGNORE_SCHEMA"))
            connection.execute(text(cls.create_table_query))
            connection.execute(text(cls.comment_column_query))
            connection.execute(text(cls.comment_table_query))
            connection.execute(
                text(f"CREATE OR REPLACE TABLE {SCHEMA_NAME}.IGNORE_TABLE AS SELECT * FROM {SCHEMA_NAME}.{TABLE_NAME}")
            )
            connection.commit()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        subprocess.run(["docker", "kill", CONTAINER_NAME], check=True, encoding="utf-8")

    @pytest.mark.order(8)
    def test_table_filter_excludes(self) -> None:
        """7. Vanilla ingestion + exclude table filter pattern

        We will perform the following steps:
            1. build config file for ingest with filters
            2. run ingest `self.run_command()` defaults to `ingestion`
        """
        self.build_config_file(E2EType.INGEST_DB_FILTER_TABLE, {"excludes": self.get_excludes_tables()})
        result = self.run_command()
        sink_status, source_status = self.retrieve_statuses(result)
        self.assert_filtered_tables_excludes(source_status, sink_status)

    @pytest.mark.order(10)
    def test_usage(self) -> None:
        """Run the usage workflow and verify query rows are attached to the table."""
        self.delete_table_and_view()
        self.create_table_and_view()
        self.build_config_file()
        self.run_command()

        table = self.openmetadata.get_by_name(
            entity=Table,
            fqn=self.fqn_created_table(),
            fields=["usageSummary", "lifeCycle"],
        )
        self.assertIsNotNone(table)

        with self.engine.begin() as connection:
            connection.execute(text(self.join_usage_query))

        wait_for_system_table(
            self.engine,
            EXASOL_SQL_STATEMENT.format(
                start_time="2000-01-01 00:00:00",
                end_time="2999-01-01 00:00:00",
                filters=ExasolUsageSource.filters,
                result_limit=20,
            ),
            expected_count=1,
            timeout_seconds=120,
        )

        self.build_config_file(E2EType.INGEST)
        with open(self.test_file_path, "r", encoding="utf-8") as file:  # noqa: PTH123
            config = yaml.safe_load(file)

        config = UsageConfigBuilder(config).build()

        with open(self.test_file_path, "w", encoding="utf-8") as file:  # noqa: PTH123
            yaml.dump(config, file, default_flow_style=False)

        result = self.run_command("usage")
        sink_status, source_status = self.retrieve_statuses(result)

        self.assertEqual(len(source_status.failures), 0)
        self.assertEqual(len(source_status.warnings), 0)
        self.assertEqual(len(sink_status.failures), 0)
        self.assertEqual(len(sink_status.warnings), 0)
        self.assertGreaterEqual(len(sink_status.records), 1)
        self.assertEqual(len(sink_status.updated_records), 0)

        table = self.openmetadata.get_by_name(
            entity=Table,
            fqn=self.fqn_created_table(),
            fields=["usageSummary", "lifeCycle", "joins"],
        )
        self.assertIsNotNone(table)
        self.assertGreaterEqual(table.usageSummary.dailyStats.count, 1)
        self.assertGreaterEqual(table.usageSummary.weeklyStats.count, 1)
        self.assertGreaterEqual(table.usageSummary.monthlyStats.count, 1)
        self.assertTrue(
            table.lifeCycle is not None and table.lifeCycle.accessed is not None,
        )

        queries = self.openmetadata.get_entity_queries(table.id.root, fields=["queryUsedIn"])
        self.assertGreater(len(queries), 0)
        select_queries = [
            query for query in queries if query.query.root and query.query.root.lstrip().upper().startswith("SELECT")
        ]
        self.assertGreater(len(select_queries), 0)

        self.assertTrue(
            any(
                any(
                    query_used_in.id.root == table.id.root
                    for query_used_in in (query.queryUsedIn.root if query.queryUsedIn else [])
                )
                for query in select_queries
            )
        )

        boolean_join = next(
            (
                column_join
                for column_join in table.joins.columnJoins
                if column_join.columnName.root.lower() == "col_boolean"
            ),
            None,
        )
        self.assertTrue(
            any(
                joined_with.fullyQualifiedName.root.lower().endswith(f".{JOIN_TABLE_NAME.lower()}.col_boolean")
                for joined_with in boolean_join.joinedWith
            ),
        )

    def assert_for_table_with_profiler(self, source_status: Status, sink_status: Status) -> None:
        super().assert_for_table_with_profiler(source_status, sink_status)

        profile = self.retrieve_profile(self.fqn_created_table())
        self.assertIsNotNone(profile.profile)
        self.assertEqual(profile.profile.rowCount, 2.0)

    def assert_table_metadata(self) -> None:
        table = None
        for _ in range(6):
            tables = self.openmetadata.list_entities(
                entity=Table,
                fields=["*"],
                params={"database": f"{SERVICE_NAME}.default"},
            ).entities
            table = next(
                (
                    candidate
                    for candidate in tables
                    if candidate.name.root.lower() == TABLE_NAME.lower()
                    and candidate.databaseSchema
                    and candidate.databaseSchema.name
                    and candidate.databaseSchema.name.lower() == SCHEMA_NAME.lower()
                ),
                None,
            )
            if table is not None:
                break
            time.sleep(5)

        self.assertIsNotNone(table)
        self.assertEqual(table.description.root, TABLE_COMMENT)

        column_names = [column.name.root for column in table.columns]
        self.assertEqual(
            column_names,
            [
                "col_boolean",
                "col_decimal",
                "col_date",
                "col_timestamp",
                "col_char",
                "col_varchar",
            ],
        )

        column_by_name = {column.name.root: column for column in table.columns}
        self.assertEqual(column_by_name["col_boolean"].description.root, COLUMN_COMMENT)
        self.assertIsNone(column_by_name["col_date"].description)

    @pytest.mark.order(100)
    def test_table_metadata_contains_comments(self) -> None:
        self.build_config_file(E2EType.INGEST_DB_FILTER_TABLE, {"excludes": self.get_excludes_tables()})
        result = self.run_command()
        sink_status, source_status = self.retrieve_statuses(result)
        self.assert_filtered_tables_excludes(source_status, sink_status)
        self.assert_table_metadata()

    @staticmethod
    def get_connector_name() -> str:
        return "exasol"

    def create_table_and_view(self) -> None:
        SQACommonMethods.create_table_and_view(self)

    def delete_table_and_view(self) -> None:
        SQACommonMethods.delete_table_and_view(self)

    @staticmethod
    def get_includes_schemas() -> List[str]:  # noqa: UP006
        return [f"{SCHEMA_NAME}.*"]

    @classmethod
    def get_excludes_schemas(cls) -> List[str]:  # noqa: UP006
        return ["IGNORE_SCHEMA.*"]

    @staticmethod
    def get_includes_tables() -> List[str]:  # noqa: UP006
        return [f"{TABLE_NAME}"]

    @staticmethod
    def get_excludes_tables() -> List[str]:  # noqa: UP006
        return ["IGNORE_TABLE"]

    @staticmethod
    def expected_tables() -> int:
        return 1

    def expected_sample_size(self) -> int:
        return len(self.insert_data_queries)

    def view_column_lineage_count(self) -> int:
        return 6

    def expected_lineage_node(self) -> str:
        return f"{SERVICE_NAME}.default.{SCHEMA_NAME}.{VIEW_NAME}"

    @staticmethod
    def fqn_created_table() -> str:
        return f"{SERVICE_NAME}.default.{SCHEMA_NAME}.{TABLE_NAME}"

    @staticmethod
    def expected_filtered_schema_includes() -> int:
        return 1

    @staticmethod
    def expected_filtered_schema_excludes() -> int:
        return 1

    @staticmethod
    def expected_filtered_table_includes() -> int:
        return 1

    @staticmethod
    def expected_filtered_table_excludes() -> int:
        return 1

    @staticmethod
    def expected_filtered_mix() -> int:
        return 2
