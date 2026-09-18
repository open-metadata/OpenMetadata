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
Integration tests for Airbyte lineage against a real OpenMetadata server.

The unit suite asserts the connector's direction rules against mocks; this proves them
against the API that actually enforces them:

1. ``apiCollection`` is accepted as an *upstream* lineage node and rejected as a downstream
   target. That rule is why an API destination is anchored on the pipeline, and until now it
   lived only in a code comment.
2. The ``apiCollection -> pipeline -> container`` graph the connector emits persists and
   reads back.

Airbyte itself is stubbed: the connector's HTTP client is the only thing an Airbyte
container would provide, and its response shapes are pinned by the unit suite.

Requires an OpenMetadata server on http://localhost:8585 with default admin creds.
"""

import time
from unittest.mock import MagicMock, patch

import pytest

from _openmetadata_testutils.ometa import OM_JWT, int_admin_ometa
from metadata.generated.schema.api.data.createAPICollection import (
    CreateAPICollectionRequest,
)
from metadata.generated.schema.api.data.createContainer import CreateContainerRequest
from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.services.createApiService import (
    CreateApiServiceRequest,
)
from metadata.generated.schema.api.services.createPipelineService import (
    CreatePipelineServiceRequest,
)
from metadata.generated.schema.api.services.createStorageService import (
    CreateStorageServiceRequest,
)
from metadata.generated.schema.entity.data.apiCollection import APICollection
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.services.apiService import (
    ApiConnection,
    ApiService,
    ApiServiceType,
)
from metadata.generated.schema.entity.services.connections.api.openAPISchemaURL import (
    OpenAPISchemaURL,
)
from metadata.generated.schema.entity.services.connections.api.restConnection import (
    RestConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
    AirbyteConnection,
)
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.entity.services.storageService import (
    StorageService,
    StorageServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.pipeline.airbyte.metadata import (
    AirbytePipelineDetails,
    AirbyteSource,
)
from metadata.ingestion.source.pipeline.airbyte.models import (
    AirbyteConnectionModel,
    AirbyteDestinationResponse,
    AirbyteSourceResponse,
    AirbyteWorkspace,
)

PIPELINE_SERVICE_NAME = "airbyte_integration_test"
API_SERVICE_NAME = "airbyte_integration_api"
STORAGE_SERVICE_NAME = "airbyte_integration_storage"
BUCKET = "airbyte-integration-bucket"
BUCKET_PATH = "api_data"
STREAM_NAME = "pokemon"
CONNECTION_ID = "5f2b1f1e-0d3a-4a2e-9d64-1b1d0c7d1f01"
CONTAINER_FULL_PATH = f"s3://{BUCKET}/{BUCKET_PATH}/{STREAM_NAME}"

AIRBYTE_WORKFLOW_CONFIG = {
    "source": {
        "type": "airbyte",
        "serviceName": PIPELINE_SERVICE_NAME,
        "serviceConnection": {
            "config": {
                "type": "Airbyte",
                "hostPort": "http://localhost:8000",
                "auth": {"username": "airbyte", "password": "airbyte"},
            }
        },
        "sourceConfig": {
            "config": {
                "type": "PipelineMetadata",
                "includeLineage": True,
                "lineageInformation": {
                    "apiServiceNames": [API_SERVICE_NAME],
                    "storageServiceNames": [STORAGE_SERVICE_NAME],
                },
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": OM_JWT},
        }
    },
}


def _wait_for(predicate, timeout: int = 60, interval: float = 1.0):
    """Poll until the server-side index or graph catches up, rather than sleeping blind.

    Container search goes through Elasticsearch, which indexes asynchronously, so a fixed
    sleep is either flaky or slower than it needs to be.
    """
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = predicate()
        if result:
            return result
        time.sleep(interval)
    return None


@pytest.fixture(scope="module")
def metadata():
    return int_admin_ometa()


@pytest.fixture(scope="module")
def pipeline_entity(metadata):
    service = metadata.create_or_update(
        CreatePipelineServiceRequest(
            name=PIPELINE_SERVICE_NAME,
            serviceType=PipelineServiceType.Airbyte,
            connection=PipelineConnection(
                config=AirbyteConnection(hostPort="http://localhost:8000"),
            ),
        )
    )
    pipeline = metadata.create_or_update(CreatePipelineRequest(name=CONNECTION_ID, service=service.fullyQualifiedName))

    yield pipeline

    metadata.delete(entity=PipelineService, entity_id=str(service.id.root), recursive=True, hard_delete=True)


@pytest.fixture(scope="module")
def container_entity(metadata):
    service = metadata.create_or_update(
        CreateStorageServiceRequest(name=STORAGE_SERVICE_NAME, serviceType=StorageServiceType.S3)
    )
    container = metadata.create_or_update(
        CreateContainerRequest(
            name=f"{BUCKET_PATH}/{STREAM_NAME}",
            service=service.fullyQualifiedName,
            fullPath=CONTAINER_FULL_PATH,
        )
    )

    yield container

    metadata.delete(entity=StorageService, entity_id=str(service.id.root), recursive=True, hard_delete=True)


@pytest.fixture(scope="module")
def api_collection_entity(metadata):
    service = metadata.create_or_update(
        CreateApiServiceRequest(
            name=API_SERVICE_NAME,
            serviceType=ApiServiceType.Rest,
            connection=ApiConnection(
                config=RestConnection(
                    openAPISchemaConnection=OpenAPISchemaURL(openAPISchemaURL="http://localhost:9999/openapi.json")
                )
            ),
        )
    )
    collection = metadata.create_or_update(
        CreateAPICollectionRequest(
            name=STREAM_NAME,
            service=service.fullyQualifiedName,
            endpointURL=f"http://localhost:9999/{STREAM_NAME}",
        )
    )

    yield collection

    metadata.delete(entity=ApiService, entity_id=str(service.id.root), recursive=True, hard_delete=True)


@pytest.fixture
def airbyte_source(metadata, pipeline_entity):
    """The real connector against the real server, with only the Airbyte client stubbed."""
    with (
        patch("metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"),
        patch("metadata.ingestion.source.pipeline.airbyte.connection.AirbyteConnection._get_client"),
    ):
        config = OpenMetadataWorkflowConfig.model_validate(AIRBYTE_WORKFLOW_CONFIG)
        source = AirbyteSource.create(
            AIRBYTE_WORKFLOW_CONFIG["source"],
            config.workflowConfig.openMetadataServerConfig,
        )

    source.metadata = metadata
    source.context.get().__dict__["pipeline"] = CONNECTION_ID
    source.context.get().__dict__["pipeline_service"] = PIPELINE_SERVICE_NAME
    source.client = MagicMock()
    source.client.get_source.return_value = AirbyteSourceResponse(sourceType="pokeapi", configuration={})
    source.client.get_destination.return_value = AirbyteDestinationResponse(
        destinationType="s3",
        configuration={"s3_bucket_name": BUCKET, "s3_bucket_path": BUCKET_PATH},
    )
    return source


def test_api_collection_is_rejected_as_a_downstream_target(metadata, container_entity, api_collection_entity):
    """
    The rule the connector is built around: OpenMetadata accepts apiCollection upstream only.
    If this ever starts succeeding, ApiResolver's single-endpoint fan-out can be dropped.
    """
    rejected = metadata.add_lineage(
        AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(id=container_entity.id, type="container"),
                toEntity=EntityReference(id=api_collection_entity.id, type="apiCollection"),
                lineageDetails=LineageDetails(source=LineageSource.PipelineLineage),
            )
        )
    )
    assert "error" in rejected

    accepted = metadata.add_lineage(
        AddLineageRequest(
            edge=EntitiesEdge(
                fromEntity=EntityReference(id=api_collection_entity.id, type="apiCollection"),
                toEntity=EntityReference(id=container_entity.id, type="container"),
                lineageDetails=LineageDetails(source=LineageSource.PipelineLineage),
            )
        )
    )
    assert "error" not in accepted


def test_connector_emits_an_api_to_container_edge_that_persists(
    metadata, airbyte_source, pipeline_entity, container_entity, api_collection_entity
):
    """End to end: the connector resolves both sides against the real catalog, the server
    accepts the edge, and it reads back with the pipeline on it."""
    # The container resolves through Elasticsearch, which indexes asynchronously.
    indexed = _wait_for(lambda: metadata.es_search_container_by_path(full_path=CONTAINER_FULL_PATH))
    assert indexed, f"container {CONTAINER_FULL_PATH} was never indexed"

    edges = [
        either.right
        for either in airbyte_source.yield_pipeline_lineage_details(
            AirbytePipelineDetails(
                workspace=AirbyteWorkspace(workspaceId="ws-integration"),
                connection=AirbyteConnectionModel(
                    connectionId=CONNECTION_ID,
                    name="airbyte-integration-connection",
                    sourceId="src-1",
                    destinationId="dst-1",
                    configurations={"streams": [{"name": STREAM_NAME}]},
                ),
            )
        )
    ]

    assert len(edges) == 1
    edge = edges[0].edge
    assert edge.fromEntity.type == "apiCollection"
    assert str(edge.fromEntity.id.root) == str(api_collection_entity.id.root)
    assert edge.toEntity.type == "container"
    assert str(edge.toEntity.id.root) == str(container_entity.id.root)
    assert str(edge.lineageDetails.pipeline.id.root) == str(pipeline_entity.id.root)

    assert "error" not in metadata.add_lineage(edges[0])

    upstream = _wait_for(
        lambda: (
            metadata.get_lineage_by_name(entity=Container, fqn=str(container_entity.fullyQualifiedName.root)) or {}
        ).get("upstreamEdges")
    )
    assert upstream, "the container edge did not read back"
    assert str(api_collection_entity.id.root) in {edge["fromEntity"] for edge in upstream}


def test_api_collection_resolves_from_the_real_search_index(metadata, api_collection_entity):
    """ApiResolver matches a stream name with the `*.<stream>` FQN search; prove the real
    index answers it (a mocked es_search_from_fqn cannot)."""
    collections = _wait_for(
        lambda: [
            collection
            for collection in metadata.es_search_from_fqn(
                entity_type=APICollection, fqn_search_string=f"*.{STREAM_NAME}"
            )
            or []
            if str(collection.id.root) == str(api_collection_entity.id.root)
        ]
    )
    assert collections, f"apiCollection *.{STREAM_NAME} was never indexed"
