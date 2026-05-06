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
from typing import List  # noqa: UP035

import pytest
from sqlalchemy import text

from .base.e2e_types import E2EType  # noqa: TID252
from .common.test_cli_db import CliCommonDB  # noqa: TID252
from .common_e2e_sqa_mixins import SQACommonMethods  # noqa: TID252

SERVICE_NAME = "local_exasol"
SCHEMA_NAME = "openmetadata_schema"
TABLE_NAME = "datatypes"
VIEW_NAME = f"view_{TABLE_NAME}"
DB_PORT = 8563
# The compressed size of this image is 3.23 GB, so it takes on the order of minutes
# to pull it.
DB_VERSION = "2025.1.8"
CONTAINER_SUFFIX = "exasoaddl"
CONTAINER_NAME = f"db_container_{CONTAINER_SUFFIX}"

VANILLA_INGESTION_SKIP_REASON = """
There are currently issues with this test, likely related to how OpenMetadata relies
upon certain SQLAlchemy functions, which seem not to be defined yet for Exasol.
This leads in the UI to warnings with a basic ingestion setup, but here, in this test,
this leads to larger problems. This will be investigated and resolved.
"""


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
            col_timestamp_local TIMESTAMP WITH LOCAL TIME ZONE,
            col_char CHAR(1),
            col_varchar VARCHAR(1)
        );
    """

    create_view_query: str = f"""
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
    """

    insert_data_queries: List[str] = [  # noqa: RUF012, UP006
        f"""
            INSERT INTO {SCHEMA_NAME}.{TABLE_NAME} (col_boolean, col_decimal, col_date, col_timestamp, col_timestamp_local, col_char, col_varchar) VALUES
            (TRUE, 18.5, '2023-07-13', '2023-07-13 06:04:45', '2023-07-13 04:04:45', 'a', 'b');
        """,
        f"""
            INSERT INTO {SCHEMA_NAME}.{TABLE_NAME} (col_boolean, col_decimal, col_date, col_timestamp, col_timestamp_local, col_char, col_varchar) VALUES
            (TRUE, -18.5, '2023-09-13', '2023-09-13 06:04:45', '2023-09-13 04:04:45', 'c', 'd');
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
        return 7

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
