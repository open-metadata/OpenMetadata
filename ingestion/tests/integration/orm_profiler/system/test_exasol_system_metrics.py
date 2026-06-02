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

"""
Validate Exasol system metrics (disabled by default). Run manually.

How to use this test
--------------------

1. Comment the @pytest.mark.skip decorator on the class.
2. Make sure the Exasol test environment is available locally.
3. The test will create a schema and table, perform INSERT/UPDATE/DELETE statements,
   run metadata ingestion, and then run the profiler workflow.
4. Once you have performed the above steps, run the test with:
   `python -m pytest tests/integration/orm_profiler/system/test_exasol_system_metrics.py`
   from the ingestion directory.

   :warning: the profiler workflow will be run for the table set in
   `PROFILER_TABLE_FILTER_PATTERN`
"""

import subprocess
from copy import deepcopy
from pathlib import Path
from unittest import TestCase

import pytest
import yaml
from sqlalchemy import create_engine, text

from ingestion.tests.integration.orm_profiler.system.utilities import wait_for_system_table
from metadata.generated.schema.entity.data.table import SystemProfile
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.exasol.queries import EXASOL_SYSTEM_METRICS_QUERY
from metadata.utils.time_utils import (
    get_beginning_of_day_timestamp_mill,
    get_end_of_day_timestamp_mill,
)
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.profiler import ProfilerWorkflow

TESTS_ROOT_DIR = Path(__file__).parent.parent.parent.parent
EXASOL_CONFIG_FILE = "cli_e2e/database/exasol/exasol.yaml"
FULL_CONFIG_PATH = Path(TESTS_ROOT_DIR, EXASOL_CONFIG_FILE)
DB_VERSION = "2025.1.8"
DB_PORT = 8563
CONTAINER_SUFFIX = "exasolorm"
CONTAINER_NAME = f"db_container_{CONTAINER_SUFFIX}"
SERVICE_NAME = "local_exasol"
SCHEMA_NAME = "openmetadata_schema"
TABLE_NAME = "datatypes"
TABLE_FQN = f"{SERVICE_NAME}.default.{SCHEMA_NAME}.{TABLE_NAME}"


def _prepare_exasol_objects(engine) -> None:
    setup_statements = [
        f"CREATE SCHEMA IF NOT EXISTS {SCHEMA_NAME}",
        f"DROP TABLE IF EXISTS {SCHEMA_NAME}.{TABLE_NAME}",
        f"""
        CREATE TABLE {SCHEMA_NAME}.{TABLE_NAME} (
            col_boolean BOOLEAN,
            col_decimal DOUBLE PRECISION,
            col_date DATE,
            col_timestamp TIMESTAMP,
            col_char CHAR(1),
            col_varchar VARCHAR(1)
        )
        """,
    ]
    dml_statements = [
        f"""
        INSERT INTO {SCHEMA_NAME}.{TABLE_NAME} (
            col_boolean,
            col_decimal,
            col_date,
            col_timestamp,
            col_char,
            col_varchar
        ) VALUES
        (TRUE, 18.5, '2023-07-13', '2023-07-13 06:04:45', 'a', 'b')
        """,
        f"""
        INSERT INTO {SCHEMA_NAME}.{TABLE_NAME} (
            col_boolean,
            col_decimal,
            col_date,
            col_timestamp,
            col_char,
            col_varchar
        ) VALUES
        (TRUE, -18.5, '2023-09-13', '2023-09-13 06:04:45', 'c', 'd')
        """,
        f"""
        UPDATE {SCHEMA_NAME}.{TABLE_NAME}
        SET col_varchar = 'z'
        WHERE col_char = 'a'
        """,
        f"""
        DELETE FROM {SCHEMA_NAME}.{TABLE_NAME}
        WHERE col_char = 'c'
        """,
    ]
    with engine.begin() as connection:
        for statement in setup_statements:
            connection.execute(text(statement))
        for statement in dml_statements:
            connection.execute(text(statement))

    query = EXASOL_SYSTEM_METRICS_QUERY.format(
        database_name="default",
        schema=SCHEMA_NAME,
        table=TABLE_NAME,
        operations="'INSERT', 'UPDATE', 'DELETE'",
    )
    wait_for_system_table(engine, query, expected_count=4)


@pytest.mark.skip(
    reason="Disabled by default. Should be ran manually on system metric updates and when systemProfile is activated"
)
class TestExasolSystem(TestCase):
    """Test class for Exasol system metrics."""

    full_config_path = FULL_CONFIG_PATH

    @classmethod
    def setUpClass(cls) -> None:
        with open(cls.full_config_path, "r", encoding="utf-8") as file:  # noqa: PTH123
            cls.config = yaml.safe_load(file)

        cls.config["source"]["sourceConfig"]["config"]["schemaFilterPattern"] = {
            "includes": [SCHEMA_NAME],
        }
        cls.config["source"]["sourceConfig"]["config"]["tableFilterPattern"] = {
            "includes": [TABLE_NAME],
        }

        cls.metadata_config_dict = cls.config["workflowConfig"]["openMetadataServerConfig"]
        cls.metadata_config = OpenMetadataConnection.model_validate(cls.metadata_config_dict)
        cls.metadata = OpenMetadata(cls.metadata_config)

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

        ingestion_workflow = MetadataWorkflow.create(cls.config)
        ingestion_workflow.execute()
        ingestion_workflow.raise_from_status()
        ingestion_workflow.print_status()
        ingestion_workflow.stop()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.engine.dispose()
        subprocess.run(["docker", "kill", CONTAINER_NAME], check=True, encoding="utf-8")

    def test_exasol_system_metrics(self):
        """Run profiler workflow and check the system metrics."""
        config = deepcopy(self.config)
        config["source"]["sourceConfig"]["config"] = {
            "type": "Profiler",
            "timeoutSeconds": 5400,
            "tableFilterPattern": {
                "includes": [TABLE_NAME],
            },
        }
        config["processor"] = {
            "type": "orm-profiler",
            "config": {},
        }

        profiler_workflow = ProfilerWorkflow.create(config)
        profiler_workflow.execute()
        profiler_workflow.raise_from_status()
        profiler_workflow.print_status()
        profiler_workflow.stop()

        profile = self.metadata.get_profile_data(
            TABLE_FQN,
            get_beginning_of_day_timestamp_mill(days=1),
            get_end_of_day_timestamp_mill(),
            profile_type=SystemProfile,
        )
        ddl_operations = {profile_entry.operation.value for profile_entry in profile.entities}
        assert ddl_operations == {"INSERT", "UPDATE", "DELETE"}
