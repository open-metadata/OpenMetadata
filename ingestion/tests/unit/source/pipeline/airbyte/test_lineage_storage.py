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
Regression tests for issue #28591 — Airbyte lineage to object-store (S3) destinations.

Covers the two defects that made an `API source -> Airbyte -> S3` flow produce no
lineage and no log output at all:

1. The public API returns streams under ``configurations.streams`` while the model only
   read ``syncCatalog.streams``, so the per-stream loop never ran and nothing was logged.
2. S3 destinations resolve to a ``container`` entity, but lineage was hardcoded to ``table``.
"""

from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.data.apiCollection import APICollection
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.metadataIngestion.pipelineServiceMetadataPipeline import (
    LineageInformation,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.pipeline.airbyte.metadata import (
    AirbytePipelineDetails,
    AirbyteSource,
)
from metadata.ingestion.source.pipeline.airbyte.models import (
    AirbyteConnectionModel,
    AirbyteDestinationResponse,
    AirbyteSourceResponse,
    AirbyteStream,
    AirbyteWorkspace,
)
from metadata.ingestion.source.pipeline.airbyte.utils import (
    get_destination_container_path,
    get_source_container_path,
)

MOCK_JWT = (
    "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9."
    "eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIs"
    "ImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREk"
    "qVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSP"
    "jHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_"
    "nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
)

MOCK_AIRBYTE_CONFIG = {
    "source": {
        "type": "airbyte",
        "serviceName": "airbyte_source",
        "serviceConnection": {
            "config": {
                "type": "Airbyte",
                "hostPort": "http://localhost:8000",
                "auth": {"username": "airbyte", "password": "airbyte"},
            }
        },
        "sourceConfig": {"config": {"type": "PipelineMetadata", "includeLineage": True}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": MOCK_JWT},
        }
    },
}

PIPELINE_ID = "2aaa012e-099a-11ed-861d-0242ac120002"
CONTAINER_ID = "bc5c3d6e-c07a-452e-b745-520e101c6a86"
BUCKET_CONTAINER_ID = "ef0a1973-ae34-4607-9e00-91e2b9021aed"

MOCK_PIPELINE_SERVICE = PipelineService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="airbyte_source",
    connection=PipelineConnection(),
    serviceType=PipelineServiceType.Airbyte,
)

MOCK_PIPELINE = Pipeline(
    id=PIPELINE_ID,
    name="248e61dc-ec52-480e-bd08-6edb8b33b14c",
    fullyQualifiedName="airbyte_source.248e61dc-ec52-480e-bd08-6edb8b33b14c",
    service=EntityReference(id=MOCK_PIPELINE_SERVICE.id, type="pipelineService"),
)

# Shapes taken verbatim from a live Airbyte 2.2.0 `api/public/v1` instance.
PUBLIC_API_SOURCE = AirbyteSourceResponse(
    sourceType="pokeapi",
    configuration={"pokemon_name": "ditto"},
)

PUBLIC_API_S3_DESTINATION = AirbyteDestinationResponse(
    destinationType="s3",
    configuration={
        "s3_bucket_name": "om28591-airbyte-dest",
        "s3_bucket_path": "api_data",
        "s3_bucket_region": "us-east-1",
        "s3_endpoint": "http://192.168.1.11:9000",
    },
)

PUBLIC_API_CONNECTION = AirbyteConnectionModel(
    connectionId="248e61dc-ec52-480e-bd08-6edb8b33b14c",
    name="om28591-pokeapi-to-minio",
    sourceId="932efb21-8a2e-450c-9c89-bafddeb55651",
    destinationId="9b32765c-84bd-4856-a54d-5f5e36f3f6c2",
    configurations={"streams": [{"name": "pokemon"}]},
)

MOCK_STORAGE_SERVICE_REF = EntityReference(
    id="9d0f0e1a-1111-4222-8333-444455556666",
    type="storageService",
    name="om28591-minio-storage",
)

MOCK_CONTAINER = Container(
    id=CONTAINER_ID,
    name="api_data/pokemon",
    fullyQualifiedName="om28591-minio-storage.om28591-airbyte-dest.api_data/pokemon",
    service=MOCK_STORAGE_SERVICE_REF,
)

API_COLLECTION_ID = "e2d0e061-aedb-4bbb-9c48-2bc436be3950"

MOCK_API_COLLECTION = APICollection(
    id=API_COLLECTION_ID,
    name="pokemon",
    fullyQualifiedName="om28591-pokeapi.pokemon",
    service=EntityReference(
        id="c1c1c1c1-2222-4333-8444-555566667777",
        type="apiService",
        name="om28591-pokeapi",
    ),
)

MOCK_OTHER_API_COLLECTION = APICollection(
    id="aaaaaaaa-1111-4222-8333-444455556666",
    name="pokemon",
    fullyQualifiedName="unrelated_api_service.pokemon",
    service=EntityReference(
        id="d2d2d2d2-2222-4333-8444-555566667777",
        type="apiService",
        name="unrelated_api_service",
    ),
)


@pytest.fixture
def airbyte_source():
    """An AirbyteSource with its client and metadata client stubbed out."""
    with (
        patch("metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"),
        patch("metadata.ingestion.source.pipeline.airbyte.connection.AirbyteConnection._get_client"),
    ):
        config = OpenMetadataWorkflowConfig.model_validate(MOCK_AIRBYTE_CONFIG)
        source = AirbyteSource.create(
            MOCK_AIRBYTE_CONFIG["source"],
            config.workflowConfig.openMetadataServerConfig,
        )

    source.context.get().__dict__["pipeline"] = MOCK_PIPELINE.name.root
    source.context.get().__dict__["pipeline_service"] = MOCK_PIPELINE_SERVICE.name.root
    source.client = MagicMock()
    source.client.get_source.return_value = PUBLIC_API_SOURCE
    source.client.get_destination.return_value = PUBLIC_API_S3_DESTINATION
    source.metadata = MagicMock()
    source.metadata.get_by_name.return_value = MOCK_PIPELINE
    # Default: no API collection matches, so the pipeline anchors the upstream side.
    source.metadata.es_search_from_fqn.return_value = []
    return source


class TestResolvedStreams:
    """Defect 1 — the public-API stream shape was silently dropped."""

    def test_public_api_configurations_streams_are_parsed(self):
        assert [s.name for s in PUBLIC_API_CONNECTION.resolved_streams] == ["pokemon"]

    def test_internal_api_sync_catalog_still_parsed(self):
        """Existing internal-API behaviour must not regress."""
        connection = AirbyteConnectionModel(
            connectionId="c1",
            syncCatalog={"streams": [{"stream": {"name": "users", "namespace": "public"}}]},
        )
        streams = connection.resolved_streams
        assert [s.name for s in streams] == ["users"]
        assert streams[0].namespace == "public"

    def test_no_streams_returns_empty_list(self):
        assert AirbyteConnectionModel(connectionId="c1").resolved_streams == []


class TestDestinationContainerPath:
    """Defect 2 — S3 destinations must resolve by path, not as a table."""

    @pytest.mark.parametrize(
        ("bucket_path", "stream_name", "expected"),
        [
            ("api_data", "pokemon", "s3://bucket/api_data/pokemon"),
            ("", "pokemon", "s3://bucket/pokemon"),
            (None, "pokemon", "s3://bucket/pokemon"),
            ("/api_data/", "pokemon", "s3://bucket/api_data/pokemon"),
            ("raw/nested/deep", "pokemon", "s3://bucket/raw/nested/deep/pokemon"),
        ],
    )
    def test_path_construction_and_normalisation(self, bucket_path, stream_name, expected):
        destination = AirbyteDestinationResponse(
            destinationType="s3",
            configuration={"s3_bucket_name": "bucket", "s3_bucket_path": bucket_path},
        )
        assert get_destination_container_path(AirbyteStream(name=stream_name), destination) == expected

    def test_display_name_type_is_accepted(self):
        """The internal API reports "S3"; the public API reports "s3"."""
        destination = AirbyteDestinationResponse(
            destinationName="S3",
            connectionConfiguration={"s3_bucket_name": "bucket", "s3_bucket_path": "p"},
        )
        assert get_destination_container_path(AirbyteStream(name="s"), destination) == "s3://bucket/p/s"

    def test_non_object_store_destination_returns_none(self):
        """Table destinations must keep flowing through the table path."""
        destination = AirbyteDestinationResponse(
            destinationName="Postgres",
            connectionConfiguration={"database": "db", "schema": "sch"},
        )
        assert get_destination_container_path(AirbyteStream(name="s"), destination) is None

    def test_missing_bucket_returns_none(self):
        destination = AirbyteDestinationResponse(destinationType="s3", configuration={})
        assert get_destination_container_path(AirbyteStream(name="s"), destination) is None


class TestPipelineToContainerLineage:
    """
    The consumer path (§21): drives the real `yield_pipeline_lineage_details` so the test
    fails if production stops connecting the Airbyte pipeline to its S3 destination.
    """

    def test_api_source_to_s3_yields_pipeline_to_container_edge(self, airbyte_source):
        airbyte_source.metadata.es_search_container_by_path.return_value = [MOCK_CONTAINER]

        edges = [
            either.right
            for either in airbyte_source.yield_pipeline_lineage_details(
                AirbytePipelineDetails(
                    workspace=AirbyteWorkspace(workspaceId="ws-1"),
                    connection=PUBLIC_API_CONNECTION,
                )
            )
        ]

        assert len(edges) == 1
        edge = edges[0].edge
        assert edge.fromEntity.type == "pipeline"
        assert str(edge.fromEntity.id.root) == PIPELINE_ID
        assert edge.toEntity.type == "container"
        assert str(edge.toEntity.id.root) == CONTAINER_ID

        # The path searched must be bucket + bucket_path + stream name.
        searched = [c.kwargs["full_path"] for c in airbyte_source.metadata.es_search_container_by_path.call_args_list]
        assert "s3://om28591-airbyte-dest/api_data/pokemon" in searched

    def test_falls_back_to_bucket_container(self, airbyte_source):
        """A manifest often registers only the bucket, not the per-stream prefix."""
        bucket_container = Container(
            id=BUCKET_CONTAINER_ID,
            name="om28591-airbyte-dest",
            fullyQualifiedName="om28591-minio-storage.om28591-airbyte-dest",
            service=MOCK_STORAGE_SERVICE_REF,
        )
        airbyte_source.metadata.es_search_container_by_path.side_effect = lambda full_path, **_: (
            [bucket_container] if full_path == "s3://om28591-airbyte-dest" else []
        )

        edges = [
            either.right
            for either in airbyte_source.yield_pipeline_lineage_details(
                AirbytePipelineDetails(
                    workspace=AirbyteWorkspace(workspaceId="ws-1"),
                    connection=PUBLIC_API_CONNECTION,
                )
            )
        ]

        assert len(edges) == 1
        assert str(edges[0].edge.toEntity.id.root) == BUCKET_CONTAINER_ID

    def test_unresolvable_container_yields_no_edge(self, airbyte_source):
        airbyte_source.metadata.es_search_container_by_path.return_value = []

        edges = list(
            airbyte_source.yield_pipeline_lineage_details(
                AirbytePipelineDetails(
                    workspace=AirbyteWorkspace(workspaceId="ws-1"),
                    connection=PUBLIC_API_CONNECTION,
                )
            )
        )

        assert edges == []

    def _lineage(self, airbyte_source):
        return [
            either.right
            for either in airbyte_source.yield_pipeline_lineage_details(
                AirbytePipelineDetails(
                    workspace=AirbyteWorkspace(workspaceId="ws-1"),
                    connection=PUBLIC_API_CONNECTION,
                )
            )
        ]

    def test_api_collection_resolves_as_upstream(self, airbyte_source):
        """The issue's full graph: API collection -> (pipeline) -> S3 container."""
        airbyte_source.source_config.lineageInformation = LineageInformation(apiServiceNames=["om28591-pokeapi"])
        airbyte_source.metadata.es_search_container_by_path.return_value = [MOCK_CONTAINER]
        airbyte_source.metadata.es_search_from_fqn.return_value = [MOCK_API_COLLECTION]

        edges = self._lineage(airbyte_source)

        assert len(edges) == 1
        edge = edges[0].edge
        assert edge.fromEntity.type == "apiCollection"
        assert str(edge.fromEntity.id.root) == API_COLLECTION_ID
        assert edge.toEntity.type == "container"
        assert str(edge.toEntity.id.root) == CONTAINER_ID
        # The pipeline must sit on the edge so the graph reads API -> Airbyte -> S3.
        assert str(edge.lineageDetails.pipeline.id.root) == PIPELINE_ID

    def test_ambiguous_api_match_falls_back_to_pipeline(self, airbyte_source):
        """Two collections named the same must not produce a guessed edge."""
        airbyte_source.source_config.lineageInformation = LineageInformation(
            apiServiceNames=["om28591-pokeapi", "unrelated_api_service"]
        )
        airbyte_source.metadata.es_search_container_by_path.return_value = [MOCK_CONTAINER]
        airbyte_source.metadata.es_search_from_fqn.return_value = [
            MOCK_API_COLLECTION,
            MOCK_OTHER_API_COLLECTION,
        ]

        edges = self._lineage(airbyte_source)

        assert len(edges) == 1
        assert edges[0].edge.fromEntity.type == "pipeline"

    def test_api_service_names_scopes_the_search(self, airbyte_source):
        """apiServiceNames must discard collections from other API services."""
        airbyte_source.source_config.lineageInformation = LineageInformation(apiServiceNames=["om28591-pokeapi"])
        airbyte_source.metadata.es_search_container_by_path.return_value = [MOCK_CONTAINER]
        airbyte_source.metadata.es_search_from_fqn.return_value = [
            MOCK_API_COLLECTION,
            MOCK_OTHER_API_COLLECTION,
        ]

        edges = self._lineage(airbyte_source)

        assert len(edges) == 1
        assert edges[0].edge.fromEntity.type == "apiCollection"
        assert str(edges[0].edge.fromEntity.id.root) == API_COLLECTION_ID

    def test_s3_source_never_matches_an_api_collection(self, airbyte_source):
        """
        Regression: an S3 source must resolve to a Container. Falling through to the
        API-collection lookup produced a confidently wrong `apiCollection -> container` edge.
        """
        airbyte_source.client.get_source.return_value = AirbyteSourceResponse(
            sourceType="s3", configuration={"bucket": "om28591-airbyte-dest"}
        )
        airbyte_source.metadata.es_search_container_by_path.return_value = [MOCK_CONTAINER]
        # An API collection with the same name as the stream exists in the catalog.
        airbyte_source.metadata.es_search_from_fqn.return_value = [MOCK_API_COLLECTION]

        edges = self._lineage(airbyte_source)

        assert len(edges) == 1
        assert edges[0].edge.fromEntity.type == "container"
        assert edges[0].edge.fromEntity.type != "apiCollection"

    def test_reverse_flow_s3_source_to_api_destination(self, airbyte_source):
        """S3 -> Airbyte -> API resolves container upstream and API collection downstream."""
        airbyte_source.source_config.lineageInformation = LineageInformation(apiServiceNames=["om28591-pokeapi"])
        airbyte_source.client.get_source.return_value = AirbyteSourceResponse(
            sourceType="s3", configuration={"bucket": "om28591-airbyte-dest"}
        )
        airbyte_source.client.get_destination.return_value = AirbyteDestinationResponse(
            destinationType="pokeapi", configuration={}
        )
        airbyte_source.metadata.es_search_container_by_path.return_value = [MOCK_CONTAINER]
        airbyte_source.metadata.es_search_from_fqn.return_value = [MOCK_API_COLLECTION]

        edges = self._lineage(airbyte_source)

        assert len(edges) == 1
        edge = edges[0].edge
        assert edge.fromEntity.type == "container"
        assert edge.toEntity.type == "apiCollection"
        assert str(edge.toEntity.id.root) == API_COLLECTION_ID

    def test_s3_source_path_anchors_on_bucket(self, airbyte_source):
        """The S3 source scopes streams by per-stream globs, so lineage uses the bucket."""
        source = AirbyteSourceResponse(sourceType="s3", configuration={"bucket": "om28591-airbyte-dest"})
        assert get_source_container_path(AirbyteStream(name="pokemon"), source) == "s3://om28591-airbyte-dest"

    def test_unsupported_destination_never_guesses_an_api_collection(self, airbyte_source):
        """
        Airbyte ships many destinations that are neither relational nor object stores
        (Kafka, MongoDB, Pinecone, /dev/null). Without apiServiceNames they must yield no
        edge rather than binding to a same-named API collection.
        """
        airbyte_source.client.get_destination.return_value = AirbyteDestinationResponse(
            destinationType="kafka", configuration={"bootstrap_servers": "localhost:9092"}
        )
        # A collection named after the stream exists and would match on name alone.
        airbyte_source.metadata.es_search_from_fqn.return_value = [MOCK_API_COLLECTION]

        assert self._lineage(airbyte_source) == []

    def test_connection_without_streams_yields_no_edge(self, airbyte_source):
        """Guards the silent-failure path: no streams must not raise, and must not emit."""
        edges = list(
            airbyte_source.yield_pipeline_lineage_details(
                AirbytePipelineDetails(
                    workspace=AirbyteWorkspace(workspaceId="ws-1"),
                    connection=AirbyteConnectionModel(connectionId="c1", sourceId="s1", destinationId="d1"),
                )
            )
        )

        assert edges == []
