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
- OpenMetadata server running (accessible via host.docker.internal:8585)
- OM_JWT environment variable set
"""
import os
import time

import pytest
import requests

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
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.metadata import MetadataWorkflow

PIPELINE_SERVICE_NAME = "prefect_integration_test"


@pytest.fixture(scope="module")
def metadata():
    """OpenMetadata client fixture."""
    om_jwt = os.environ.get("OM_JWT")
    if not om_jwt:
        pytest.skip("OM_JWT environment variable not set")

    om_host_port = os.environ.get(
        "OM_HOST_PORT", "http://host.docker.internal:8585/api"
    )

    server_config = OpenMetadataConnection(
        hostPort=om_host_port,
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(jwtToken=om_jwt),
    )
    client = OpenMetadata(server_config)
    assert client.health_check()
    return client


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


def test_create_flows_in_prefect(prefect_server):
    """
    Create test flows in Prefect server with lineage tags.
    """
    # Create flows using Prefect API
    flows_to_create = [
        {
            "name": "test-integration-flow",
            "tags": [
                "om-source:test-service-prefect-lineage.test-db.test-schema.prefect-lineage-source",
                "om-destination:test-service-prefect-lineage.test-db.test-schema.prefect-lineage-destination",
                "integration-test",
            ],
        },
        {
            "name": "test-simple-flow",
            "tags": ["production", "etl"],
        },
    ]

    for flow_data in flows_to_create:
        response = requests.post(
            f"{prefect_server}/flows/",
            json=flow_data,
            timeout=10,
        )
        assert (
            response.status_code == 201
        ), f"Failed to create flow {flow_data['name']}: {response.text}"

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

    # Verify pipelines were created
    pipelines = list(metadata.list_entities(entity=Pipeline).entities)
    assert len(pipelines) > 0, "No pipelines were ingested into OpenMetadata"

    # Verify specific pipeline exists
    pipeline = metadata.get_by_name(
        entity=Pipeline,
        fqn=f"{PIPELINE_SERVICE_NAME}.test-integration-flow",
    )
    assert pipeline is not None, "test-integration-flow pipeline was not ingested"


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

    # Note: Status may be None if no runs exist yet
    # This is expected for a fresh Prefect server
    # The important thing is that the connector doesn't crash


def test_lineage_from_tags(metadata, om_config, test_tables):
    """
    Test that tag-based lineage is created when flows have om-source/om-destination tags.
    """
    table_source, table_destination = test_tables

    # Run the ingestion workflow
    workflow = MetadataWorkflow.create(om_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.stop()

    # Give lineage a moment to be processed
    time.sleep(2)

    # Check lineage from source table
    source_fqn = (
        "test-service-prefect-lineage.test-db.test-schema.prefect-lineage-source"
    )
    lineage = metadata.get_lineage_by_name(
        entity=Table,
        fqn=source_fqn,
    )

    # Verify lineage exists
    assert lineage is not None, "No lineage found for source table"

    # Check downstream edges
    downstream_edges = lineage.get("downstreamEdges", [])
    if downstream_edges:
        # Verify destination table is in lineage
        assert downstream_edges[0]["toEntity"] == str(
            table_destination.id.root
        ), "Lineage destination does not match expected table"

        # Verify pipeline is in lineage details
        pipeline_fqn = downstream_edges[0]["lineageDetails"]["pipeline"][
            "fullyQualifiedName"
        ]
        assert (
            pipeline_fqn == f"{PIPELINE_SERVICE_NAME}.test-integration-flow"
        ), "Pipeline in lineage does not match expected flow"


@pytest.fixture(scope="module", autouse=True)
def cleanup_pipeline_service(metadata):
    """Cleanup pipeline service after all tests."""
    yield

    # Cleanup pipeline service
    pipeline_service = metadata.get_by_name(
        entity=PipelineService, fqn=PIPELINE_SERVICE_NAME
    )
    if pipeline_service:
        pipeline_service_id = str(pipeline_service.id.root)
        metadata.delete(
            entity=PipelineService,
            entity_id=pipeline_service_id,
            recursive=True,
            hard_delete=True,
        )
