#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Opt-in BigQuery rollover through the release CLI and a real catalog."""

import json
import os
import subprocess
from copy import deepcopy
from uuid import uuid4

import pytest
from google.cloud import bigquery

from metadata.config.common import load_config_file
from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import OpenMetadataConnection
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn

pytestmark = pytest.mark.skipif(
    not (os.environ.get("BQ_SHARDING_E2E_CONFIG") and os.environ.get("BQ_SHARDING_E2E_PROJECT")),
    reason="Set BQ_SHARDING_E2E_CONFIG (metadata YAML), BQ_SHARDING_E2E_PROJECT and Google ADC for cloud execution",
)


def test_family_rollover_and_persisted_execution_scope(tmp_path):
    config = load_config_file(os.environ["BQ_SHARDING_E2E_CONFIG"])
    project = os.environ["BQ_SHARDING_E2E_PROJECT"]
    dataset = "om_sharding_" + uuid4().hex[:12]
    service = dataset
    client = bigquery.Client(project=project)
    om = OpenMetadata(OpenMetadataConnection.model_validate(config["workflowConfig"]["openMetadataServerConfig"]))
    client.create_dataset(bigquery.Dataset(f"{project}.{dataset}"))
    base = deepcopy(config)
    base["source"]["serviceName"] = service
    family_fqn = fqn.build(
        om,
        entity_type=Table,
        service_name=service,
        database_name=project,
        schema_name=dataset,
        table_name="events_yyyymmdd",
    )

    def run(command, source_config, processor=None):
        workflow = deepcopy(base)
        workflow["source"]["sourceConfig"] = {"config": source_config}
        if command == "test":
            source_config["serviceConnections"] = [
                {"serviceName": service, "serviceConnection": workflow["source"].pop("serviceConnection")}
            ]
        if processor:
            workflow["processor"] = processor
        else:
            workflow.pop("processor", None)
        path = tmp_path / f"{command}.json"
        path.write_text(json.dumps(workflow))
        path.chmod(0o600)
        subprocess.run(["metadata", command, "-c", str(path)], check=True)

    filters = {
        "databaseFilterPattern": {"includes": [f"^{project}$"]},
        "schemaFilterPattern": {"includes": [f"^{dataset}$"]},
        "tableFilterPattern": {"includes": ["^events_yyyymmdd$"]},
    }

    def ingest():
        run(
            "ingest",
            {
                "type": "DatabaseMetadata",
                **filters,
                "shardedTables": {"enabled": True},
                "includeStoredProcedures": False,
                "markDeletedTables": False,
            },
        )

    try:
        for day, rows in ((1, "1"), (2, "1, 2")):
            client.query(
                f"CREATE TABLE `{project}.{dataset}.events_2026010{day}` AS SELECT id FROM UNNEST([{rows}]) AS id"
            ).result()
        ingest()
        table = om.get_by_name(Table, family_fqn)
        assert table.tableType == TableType.Sharded
        assert table.tableSharding.shardCount == 2
        assert table.tableSharding.representative.tableName == "events_20260102"

        run("profile", {"type": "Profiler", **filters}, {"type": "orm-profiler", "config": {}})
        measured = om.get_latest_table_profile(family_fqn)
        assert measured.profile.rowCount == 2
        assert measured.profile.executionSource.tableName == "events_20260102"
        assert any(column.profile for column in measured.columns)
        assert all(
            column.profile.executionSource.tableName == "events_20260102"
            for column in measured.columns
            if column.profile
        )

        run(
            "classify",
            {"type": "AutoClassification", **filters, "storeSampleData": True, "enableAutoClassification": False},
        )
        sampled = om.get_sample_data(table)
        assert sampled.sampleData.executionSource.tableName == "events_20260102"
        assert len(sampled.sampleData.rows) == 2

        case_name = "representative_row_count"
        run(
            "test",
            {"type": "TestSuite", "entityFullyQualifiedName": family_fqn},
            {
                "type": "orm-test-runner",
                "config": {
                    "testCases": [
                        {
                            "name": case_name,
                            "testDefinitionName": "tableRowCountToBeBetween",
                            "parameterValues": [{"name": "minValue", "value": "2"}, {"name": "maxValue", "value": "2"}],
                        }
                    ]
                },
            },
        )
        case_fqn = f"{family_fqn}.{case_name}"
        tested = om.get_by_name(TestCase, case_fqn, fields=["testCaseResult"])
        assert tested.testCaseResult.testCaseStatus.value == "Success"
        assert tested.testCaseResult.evaluationScope.executionSource.tableName == "events_20260102"

        client.query(f"CREATE TABLE `{project}.{dataset}.events_20260103` AS SELECT 3 AS id").result()
        ingest()
        rolled = om.get_by_name(Table, family_fqn)
        assert rolled.id == table.id
        assert rolled.tableSharding.representative.tableName == "events_20260103"
        assert om.get_latest_table_profile(family_fqn).profile.executionSource.tableName == "events_20260102"
        assert (
            om.get_by_name(
                TestCase, case_fqn, fields=["testCaseResult"]
            ).testCaseResult.evaluationScope.executionSource.tableName
            == "events_20260102"
        )
    finally:
        client.delete_dataset(f"{project}.{dataset}", delete_contents=True, not_found_ok=True)
        catalog_service = om.get_by_name(DatabaseService, service)
        if catalog_service:
            om.delete(DatabaseService, catalog_service.id, recursive=True, hard_delete=True)
        om.close()
        client.close()
