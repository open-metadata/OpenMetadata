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
Integration tests for Prefect connector with Docker.

Tests verify:
1. Pipeline metadata ingestion
2. Pipeline status ingestion
3. Tag-based lineage creation

Requires:
- Docker installed and running
- OpenMetadata server running locally (http://localhost:8585), default admin creds
"""

import time

import pytest
import requests

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.workflow.metadata import MetadataWorkflow

PIPELINE_SERVICE_NAME = "prefect_integration_test"


@pytest.fixture(scope="module")
def metadata():
    """OpenMetadata client fixture."""
    return int_admin_ometa()


@pytest.fixture(scope="module")
def test_service(metadata):
    """Create test database service for lineage testing."""
    service = CreateDatabaseServiceRequest(
        name="test-service-prefect-lineage",
        serviceType=DatabaseServiceType.Mysql,
        connection=DatabaseConnection(
            config=MysqlConnection(
                username="username",
                authType=BasicAuth(password="password"),
                hostPort="http://localhost:1234",
            )
        ),
    )
    service_entity = metadata.create_or_update(data=service)

    yield service_entity

    # Cleanup
    service_id = str(service_entity.id.root)
    metadata.delete(
        entity=DatabaseService,
        entity_id=service_id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def test_tables(metadata, test_service):
    """Create test tables for lineage testing."""
    # Create database
    create_db = CreateDatabaseRequest(
        name="test-db",
        service=test_service.fullyQualifiedName,
    )
    create_db_entity = metadata.create_or_update(data=create_db)

    # Create schema
    create_schema = CreateDatabaseSchemaRequest(
        name="test-schema",
        database=create_db_entity.fullyQualifiedName,
    )
    create_schema_entity = metadata.create_or_update(data=create_schema)

    # Create source table
    create_source = CreateTableRequest(
        name="prefect-lineage-source",
        databaseSchema=create_schema_entity.fullyQualifiedName,
        columns=[Column(name="id", dataType=DataType.BIGINT)],
    )

    # Create destination table
    create_destination = CreateTableRequest(
        name="prefect-lineage-destination",
        databaseSchema=create_schema_entity.fullyQualifiedName,
        columns=[Column(name="id", dataType=DataType.BIGINT)],
    )

    table_source = metadata.create_or_update(data=create_source)
    table_destination = metadata.create_or_update(data=create_destination)

    return table_source, table_destination


@pytest.mark.order(1)
def test_create_flows_in_prefect(prefect_server):
    """
    Seed Prefect with everything the connector reads from: a flow, a
    deployment (the connector's only source of tags/lineage-tags/schedule —
    flow-level tags are never consumed, see metadata.py's _get_all_tags), a
    completed flow run (for pipeline status), and a task run on that run
    (for the task DAG).
    """
    flow_resp = requests.post(
        f"{prefect_server}/flows/",
        json={"name": "test-integration-flow"},
        timeout=10,
    )
    assert flow_resp.status_code == 201, f"Failed to create flow: {flow_resp.text}"
    flow_id = flow_resp.json()["id"]

    simple_flow_resp = requests.post(
        f"{prefect_server}/flows/",
        json={"name": "test-simple-flow"},
        timeout=10,
    )
    assert simple_flow_resp.status_code == 201, f"Failed to create flow: {simple_flow_resp.text}"

    # Deployment tags are what yield_pipeline/yield_tag/yield_pipeline_lineage_details
    # actually read (via _get_all_tags) — this is the real tag/lineage source.
    dep_resp = requests.post(
        f"{prefect_server}/deployments/",
        json={
            "flow_id": flow_id,
            "name": "test-integration-deployment",
            "tags": [
                # <database>.<schema>.<table> -- no service name segment, that's
                # resolved separately via sourceConfig.lineageInformation.dbServiceNames
                "om-source:test-db.test-schema.prefect-lineage-source",
                "om-destination:test-db.test-schema.prefect-lineage-destination",
                "integration-test",
            ],
        },
        timeout=10,
    )
    assert dep_resp.status_code == 201, f"Failed to create deployment: {dep_resp.text}"

    run_resp = requests.post(
        f"{prefect_server}/flow_runs/",
        json={"flow_id": flow_id, "state": {"type": "COMPLETED", "name": "Completed"}},
        timeout=10,
    )
    assert run_resp.status_code == 201, f"Failed to create flow run: {run_resp.text}"
    flow_run_id = run_resp.json()["id"]

    task_run_resp = requests.post(
        f"{prefect_server}/task_runs/",
        json={
            "flow_run_id": flow_run_id,
            "task_key": "extract",
            "name": "extract",
            "dynamic_key": "0",
            "tags": ["etl"],
            "state": {"type": "COMPLETED", "name": "Completed"},
        },
        timeout=10,
    )
    assert task_run_resp.status_code == 201, f"Failed to create task run: {task_run_resp.text}"

    # Verify flows were created using POST /flows/filter
    response = requests.post(
        f"{prefect_server}/flows/filter",
        json={},
        timeout=10,
    )
    assert response.status_code == 200
    flows = response.json()
    flow_names = [f["name"] for f in flows]
    assert "test-integration-flow" in flow_names
    assert "test-simple-flow" in flow_names


def test_pipeline_ingestion(metadata, om_config, test_tables):
    """
    Test that pipelines are ingested from Prefect into OpenMetadata.
    """
    # Run the ingestion workflow
    workflow = MetadataWorkflow.create(om_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.stop()

    # Verify the specific flow we seeded was ingested (not "some pipeline exists" --
    # that'd pass even if this exact flow failed to come through)
    pipeline = metadata.get_by_name(
        entity=Pipeline,
        fqn=f"{PIPELINE_SERVICE_NAME}.test-integration-flow",
        fields=["tags", "tasks"],
    )
    assert pipeline is not None, "test-integration-flow pipeline was not ingested"

    # Deployment tags -> Pipeline.tags (yield_tag + yield_pipeline)
    tag_names = {tag.tagFQN.root for tag in pipeline.tags or []}
    assert any(name.endswith(".integration-test") for name in tag_names), (
        f"'integration-test' deployment tag not ingested, got: {tag_names}"
    )

    # Task run -> Pipeline.tasks (yield_pipeline's task DAG)
    task_names = {task.name for task in pipeline.tasks or []}
    assert "extract" in task_names, f"Task run not ingested into pipeline tasks, got: {task_names}"


def test_pipeline_status_ingestion(metadata, om_config, test_tables):
    """
    Test that pipeline run statuses are ingested.
    """
    # Run the ingestion workflow
    workflow = MetadataWorkflow.create(om_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.stop()

    # Get pipeline with status
    pipeline = metadata.get_by_name(
        entity=Pipeline,
        fqn=f"{PIPELINE_SERVICE_NAME}.test-integration-flow",
        fields=["pipelineStatus"],
    )
    assert pipeline is not None
    assert pipeline.pipelineStatus is not None, "No pipeline status ingested for the seeded completed flow run"
    assert pipeline.pipelineStatus.executionStatus.value == "Successful", (
        f"Expected Successful (from the seeded COMPLETED flow run), got {pipeline.pipelineStatus.executionStatus}"
    )

    # The specific task run we seeded, not just "some task status exists"
    task_statuses = {t.name: t.executionStatus.value for t in pipeline.pipelineStatus.taskStatus or []}
    assert task_statuses.get("extract") == "Successful", (
        f"Expected the seeded 'extract' task run as Successful, got: {task_statuses}"
    )


def test_lineage_from_tags(metadata, om_config, test_tables):
    """
    Test that tag-based lineage is created when flows have om-source/om-destination tags.
    """
    _, table_destination = test_tables

    # Run the ingestion workflow
    workflow = MetadataWorkflow.create(om_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.stop()

    # Give lineage a moment to be processed
    time.sleep(2)

    # Check lineage from source table
    source_fqn = "test-service-prefect-lineage.test-db.test-schema.prefect-lineage-source"
    lineage = metadata.get_lineage_by_name(
        entity=Table,
        fqn=source_fqn,
    )

    # Verify lineage exists
    assert lineage is not None, "No lineage found for source table"

    # Check downstream edges -- hard assertion: the seeded deployment tags
    # (om-source:.../om-destination:...) must produce a real edge, not just
    # "the API call succeeded". A prior version of this test only checked
    # this `if downstream_edges:`, which silently passed even with zero
    # edges -- exactly what happened while tags lived on the flow instead
    # of the deployment (the connector never reads flow-level tags).
    downstream_edges = lineage.get("downstreamEdges", [])
    assert downstream_edges, "No lineage edges found for source table"

    # Verify destination table is in lineage
    assert downstream_edges[0]["toEntity"] == str(table_destination.id.root), (
        "Lineage destination does not match expected table"
    )

    # Verify pipeline is in lineage details
    pipeline_fqn = downstream_edges[0]["lineageDetails"]["pipeline"]["fullyQualifiedName"]
    assert pipeline_fqn == f"{PIPELINE_SERVICE_NAME}.test-integration-flow", (
        "Pipeline in lineage does not match expected flow"
    )


def test_lineage_survives_include_tags_false(metadata, om_config, test_tables):
    """
    Lineage must not depend on tag-sync being enabled: yield_pipeline_lineage_details
    reads deployment tags via client.get_deployments, not the persisted Pipeline.tags
    (which stays empty when includeTags=False). See metadata.py's
    yield_pipeline_lineage_details docstring.
    """
    om_config["source"]["sourceConfig"]["config"]["includeTags"] = False

    workflow = MetadataWorkflow.create(om_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.stop()

    time.sleep(2)

    source_fqn = "test-service-prefect-lineage.test-db.test-schema.prefect-lineage-source"
    lineage = metadata.get_lineage_by_name(entity=Table, fqn=source_fqn)
    downstream_edges = lineage.get("downstreamEdges", [])
    assert downstream_edges, "No lineage edges found for source table with includeTags=False"


@pytest.fixture(scope="module", autouse=True)
def cleanup_pipeline_service(metadata):
    """Cleanup pipeline service after all tests."""
    yield

    # Cleanup pipeline service
    pipeline_service = metadata.get_by_name(entity=PipelineService, fqn=PIPELINE_SERVICE_NAME)
    if pipeline_service:
        pipeline_service_id = str(pipeline_service.id.root)
        metadata.delete(
            entity=PipelineService,
            entity_id=pipeline_service_id,
            recursive=True,
            hard_delete=True,
        )
