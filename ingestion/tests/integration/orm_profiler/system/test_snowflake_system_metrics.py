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
Validate snowflake system metrics (will be disabled by default). To be ran manually

How to use this test
--------------------

1. Comment the @pytest.mark.skip decorator on line 31
2. Make sure you have set up the right environment variables for the snowflake database
   check the config file at "cli_e2e/database/snowflake/snowflake.yaml". The metadata
   ingestion will ingest data from the `TEST_DB` schema.
3. Prior to running this test you will need to execute DDLs in the `TEST_DB` schema.
   We will need to perform at least one `DELETE`, `INSERT`, `UPDATE` on any table from the schema.
   query example:
    ```
    INSERT INTO TEST_DB.TEST_SCHEMA.NEW_TAB VALUES
    (1, 'FOO'),
    (2, 'BAR'),
    (3, 'BAZZ')

    INSERT OVERWRITE INTO TEST_DB.TEST_SCHEMA.NEW_TAB VALUES
    (4, 'FOOBAR'),
    (5, 'FOOBAZZ'),
    (6, 'BARBAZZ')

    UPDATE TEST_DB.TEST_SCHEMA.NEW_TAB SET NAME='BABAR' WHERE id = 6;

    MERGE INTO TEST_DB.TEST_SCHEMA.NEW_TAB NT USING (SELECT 5 AS id, 'BAR' AS NAME) N ON NT.id = N.id
    WHEN MATCHED THEN UPDATE SET NT.NAME = N.NAME;

    DELETE FROM TEST_DB.TEST_SCHEMA.NEW_TAB WHERE ID = 4;
    ```
4. Once you have performed the above steps, run the test with the following command:
   `python -m pytest tests/integration/orm_profiler/system/test_snowflake_system_metrics.py` from the ingestion directory.
   You can also perform the same action with your IDE.

   :warning: the profiler workflow will be ran for the table set in `PROFILER_TABLE_FILTER_PATTERN`
"""

import os
import pathlib
from copy import deepcopy
from unittest import TestCase

import pytest
import yaml

from metadata.generated.schema.entity.data.table import SystemProfile
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.time_utils import (
    get_beginning_of_day_timestamp_mill,
    get_end_of_day_timestamp_mill,
)
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.profiler import ProfilerWorkflow

TESTS_ROOT_DIR = pathlib.Path(__file__).parent.parent.parent.parent
SNOWFLAKE_CONFIG_FILE = "cli_e2e/database/snowflake/snowflake.yaml"
FULL_CONFIG_PATH = pathlib.Path(TESTS_ROOT_DIR, SNOWFLAKE_CONFIG_FILE)
DATABASE_FILTER = {
    "includes": "TEST_DB",
    "excludes": None,
}
SCHEMA_FILTER = {
    "includes": "TEST_SCHEMA",
    "excludes": None,
}
TABLE_FILTER = {
    "includes": "NEW_TAB",
    "excludes": None,
}


@pytest.mark.skip(
    reason="Disabled by default. Should be ran manually on system metric updates"
)
class TestSnowflakeystem(TestCase):
    """Test class for snowflake system metrics"""

    account = os.environ.get("E2E_SNOWFLAKE_ACCOUNT")
    warehouse = os.environ.get("E2E_SNOWFLAKE_WAREHOUSE")
    username = os.environ.get("E2E_SNOWFLAKE_USERNAME")
    password = os.environ.get("E2E_SNOWFLAKE_PASSWORD")
    database = DATABASE_FILTER["includes"]

    full_config_path = FULL_CONFIG_PATH

    schema = SCHEMA_FILTER["includes"]
    table = TABLE_FILTER["includes"]

    @classmethod
    def setUpClass(cls) -> None:
        """set up class"""
        with open(cls.full_config_path, "r", encoding="utf-8") as file:
            cls.config = yaml.safe_load(file)

        # set up the config to filter from the `dbt_jaffle` schema
        cls.config["source"]["sourceConfig"]["config"]["schemaFilterPattern"] = {
            "includes": [cls.schema],
        }
        cls.config["source"]["sourceConfig"]["config"]["tableFilterPattern"] = {
            "includes": [cls.table],
        }
        cls.config["source"]["serviceConnection"]["config"]["account"] = cls.account
        cls.config["source"]["serviceConnection"]["config"]["warehouse"] = cls.warehouse
        cls.config["source"]["serviceConnection"]["config"]["username"] = cls.username
        cls.config["source"]["serviceConnection"]["config"]["password"] = cls.password
        cls.config["source"]["serviceConnection"]["config"]["database"] = cls.database

        # set metadata config
        cls.metadata_config_dict = cls.config["workflowConfig"][
            "openMetadataServerConfig"
        ]
        cls.metadata_config = OpenMetadataConnection.model_validate(
            cls.metadata_config_dict
        )
        cls.metadata = OpenMetadata(cls.metadata_config)

        # run the ingestion workflow
        ingestion_workflow = MetadataWorkflow.create(cls.config)
        ingestion_workflow.execute()
        ingestion_workflow.raise_from_status()
        ingestion_workflow.print_status()
        ingestion_workflow.stop()

        # get table fqn
        cls.table_fqn = f"{cls.config['source']['serviceName']}.{cls.database}.{cls.schema}.{cls.table}"

    def test_snowflake_system_metrics(self):
        """run profiler workflow and check the system metrics"""
        config = deepcopy(self.config)
        # update the config to run the profiler workflow
        config["source"]["sourceConfig"]["config"] = {
            "type": "Profiler",
            "generateSampleData": True,
            "timeoutSeconds": 5400,
            "tableFilterPattern": {
                "includes": [self.table],
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

        # get latest profile metrics
        profile = self.metadata.get_profile_data(
            self.table_fqn,
            get_beginning_of_day_timestamp_mill(days=1),
            get_end_of_day_timestamp_mill(),
            profile_type=SystemProfile,
        )
        ddl_operations = [prl.operation.value for prl in profile.entities]
        assert set(ddl_operations) == set(["INSERT", "UPDATE", "DELETE"])
