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
Validate bigquery system metrics (will be disabled by default). To be ran manually

How to use this test
--------------------

1. Comment the @pytest.mark.skip decorator on line 31
2. Make sure you have set up the right environment variables for the bigquery database
   check the config file at "cli_e2e/database/bigquery/bigquery.yaml". The metadata
   ingestion will ingest data from the `dbt_jaffle` schema.
3. Prior to running this test you will need to execute DDLs in the `dbt_jaffle` schema.
   We will need to perform at least one `DELETE`, `INSERT`, `UPDATE` on any table from the schema.
   query example:
        ```
        INSERT INTO dbt_jaffle.Person  VALUES
        ('John', 'Doe', 'II'),
        ('Jane', 'Doe', 'II'),
        ('Jeff', 'Doe', 'II')

        UPDATE dbt_jaffle.Person SET add = 'IV' WHERE first_name = 'John';

        MERGE INTO dbt_jaffle.Person NT USING (SELECT 'Jeff' AS first_name, 'Doe' AS last_name, NULL AS add) N ON NT.first_name = N.first_name
        WHEN MATCHED THEN UPDATE SET NT.first_name = N.first_name;

        DELETE FROM dbt_jaffle.Person WHERE first_name = 'John';
        ```
4. Once you have performed the above steps, run the test with the following command:
   `python -m pytest tests/integration/orm_profiler/system/test_bigquery_system_metrics.py` from the ingestion directory.
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
BIGQUERY_CONFIG_FILE = "cli_e2e/database/bigquery/bigquery.yaml"
FULL_CONFIG_PATH = pathlib.Path(TESTS_ROOT_DIR, BIGQUERY_CONFIG_FILE)
DATABASE_FILTER = {
    "includes": os.environ.get("E2E_BQ_PROJECT_ID"),
    "excludes": None,
}
SCHEMA_FILTER = {
    "includes": "dbt_jaffle",
    "excludes": None,
}
TABLE_FILTER = {
    "includes": "Person",
    "excludes": None,
}


@pytest.mark.skip(
    reason="Disabled by default. Should be ran manually on system metric updates"
)
class TestBigquerySystem(TestCase):
    """Test class for bigquery system metrics"""

    taxonomy = os.environ.get("E2E_BQ_PROJECT_ID_TAXONOMY")
    private_key_id = os.environ.get("E2E_BQ_PRIVATE_KEY_ID")
    private_key = os.environ.get("E2E_BQ_PRIVATE_KEY")
    project_id = DATABASE_FILTER["includes"]
    client_email = os.environ.get("E2E_BQ_CLIENT_EMAIL")
    client_id = os.environ.get("E2E_BQ_CLIENT_ID")

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
        cls.config["source"]["serviceConnection"]["config"]["credentials"]["gcpConfig"][
            "projectId"
        ] = cls.project_id
        cls.config["source"]["serviceConnection"]["config"]["credentials"]["gcpConfig"][
            "privateKeyId"
        ] = cls.private_key_id
        cls.config["source"]["serviceConnection"]["config"]["credentials"]["gcpConfig"][
            "privateKey"
        ] = cls.private_key
        cls.config["source"]["serviceConnection"]["config"]["credentials"]["gcpConfig"][
            "clientEmail"
        ] = cls.client_email
        cls.config["source"]["serviceConnection"]["config"]["credentials"]["gcpConfig"][
            "clientId"
        ] = cls.client_id
        cls.config["source"]["serviceConnection"]["config"]["taxonomyProjectID"] = [
            cls.taxonomy
        ]

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
        cls.table_fqn = f"{cls.config['source']['serviceName']}.{cls.project_id}.{cls.schema}.{cls.table}"

    def test_bigquery_system_metrics(self):
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
