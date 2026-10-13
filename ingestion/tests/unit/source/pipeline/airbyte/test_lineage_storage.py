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

API entities resolve the same way in both directions. An earlier revision resolved them on the
source side only, because a downstream ``apiCollection`` edge returned HTTP 500; that was server
bug #33448 in the ADD_UPDATE_LINEAGE script, fixed in 1465ab330af, not a rule about apiCollection.
"""

import logging
from types import SimpleNamespace
from typing import ClassVar
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.data.apiCollection import APICollection
from metadata.generated.schema.entity.data.apiEndpoint import APIEndpoint
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.searchIndex import SearchIndex
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
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
from metadata.ingestion.source.pipeline.airbyte.constants import ES_MATCH_LIMIT
from metadata.ingestion.source.pipeline.airbyte.metadata import (
    AirbytePipelineDetails,
    AirbyteSource,
)
from metadata.ingestion.source.pipeline.airbyte.models import (
    AirbyteConnectionConfigurations,
    AirbyteConnectionModel,
    AirbyteDestinationResponse,
    AirbyteSourceResponse,
    AirbyteStream,
    AirbyteWorkspace,
)
from metadata.ingestion.source.pipeline.airbyte.resolvers import (
    DESTINATION,
    SOURCE,
    SearchIndexResolver,
    TopicResolver,
    get_resolver,
)
from metadata.ingestion.source.pipeline.airbyte.utils import (
    get_destination_container_path,
    get_destination_table_details,
    get_source_container_path,
    get_source_table_details,
    render_stream_pattern,
    service_supports_database,
    table_fqn_candidates,
    to_s3_safe_characters,
)
from metadata.ingestion.source.pipeline.openlineage.models import TableDetails

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

    def test_reverse_flow_s3_source_to_api_destination_resolves_the_collection(self, airbyte_source):
        """
        S3 -> Airbyte -> API: an apiCollection is a valid downstream target, so the destination
        resolves to it directly rather than being anchored on the pipeline.
        """
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
        assert str(edge.fromEntity.id.root) == CONTAINER_ID
        assert edge.toEntity.type == "apiCollection"
        assert str(edge.toEntity.id.root) == API_COLLECTION_ID
        # Both sides resolved, so the pipeline sits on the edge rather than anchoring it.
        assert str(edge.lineageDetails.pipeline.id.root) == PIPELINE_ID

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


def _stub(entity_id, fqn=None):
    """Minimal entity double: resolvers read only ``.id`` and ``.fullyQualifiedName``."""
    return SimpleNamespace(id=entity_id, fullyQualifiedName=fqn)


def _route_get_by_name(mapping):
    """get_by_name side effect: pipeline lookup returns the pipeline, everything else by class."""

    def _fn(entity=None, fqn=None, **_):
        return MOCK_PIPELINE if entity is Pipeline else mapping.get(entity)

    return _fn


TOPIC_ID = "11111111-1111-4111-8111-111111111111"
SEARCH_ID = "22222222-2222-4222-8222-222222222222"
TABLE_ID = "33333333-3333-4333-8333-333333333333"
ENDPOINT_ID = "44444444-4444-4444-8444-444444444444"
OTHER_TABLE_ID = "55555555-5555-4555-8555-555555555555"


class TestResolverRegistry:
    """The connector-type registry dispatches every kind, unknowns fall back to API."""

    @pytest.mark.parametrize("direction", [SOURCE, DESTINATION])
    def test_dispatch_maps_types_to_entity_kinds(self, direction):
        assert get_resolver("s3", direction).om_type == "container"
        assert get_resolver("S3", direction).om_type == "container"
        assert get_resolver("postgres", direction).om_type == "table"
        assert get_resolver("redshift", direction).om_type == "table"
        # Warehouses are mapped so they never fall through to the API resolver.
        assert get_resolver("snowflake", direction).om_type == "table"
        assert get_resolver("bigquery", direction).om_type == "table"
        assert get_resolver("kafka", direction).om_type == "topic"
        assert get_resolver("elasticsearch", direction).om_type == "searchIndex"
        # Unknown connector (a SaaS API, /dev/null, vector DB) -> None: the caller then tries
        # the opt-in API resolver and, failing that, anchors on the pipeline.
        assert get_resolver("hubspot", direction) is None
        assert get_resolver(None, direction) is None

    def test_source_only_connectors_are_not_supported_destinations(self):
        """Airbyte ships MongoDB as a source only; a shared registry called it a supported
        destination and dropped the edge instead of anchoring it on the pipeline."""
        assert get_resolver("mongodb", SOURCE).om_type == "table"
        assert get_resolver("mongodb", DESTINATION) is None


class TestNewEntityKinds:
    """Registry ships topic / searchIndex / warehouse resolution, each via the shared loop."""

    def _lineage(self, source, connection_source, connection_dest):
        source.client.get_source.return_value = connection_source
        source.client.get_destination.return_value = connection_dest
        return [
            either.right
            for either in source.yield_pipeline_lineage_details(
                AirbytePipelineDetails(workspace=AirbyteWorkspace(workspaceId="ws-1"), connection=PUBLIC_API_CONNECTION)
            )
        ]

    def test_kafka_source_to_s3_yields_topic_to_container(self, airbyte_source):
        airbyte_source.source_config.lineageInformation = LineageInformation(
            messagingServiceNames=["kafka_svc"], storageServiceNames=["om28591-minio-storage"]
        )
        airbyte_source.metadata.get_by_name.side_effect = _route_get_by_name({Topic: _stub(TOPIC_ID)})
        airbyte_source.metadata.es_search_container_by_path.return_value = [MOCK_CONTAINER]
        with patch("metadata.ingestion.source.pipeline.airbyte.resolvers.fqn.build", return_value="kafka_svc.pokemon"):
            edges = self._lineage(
                airbyte_source,
                AirbyteSourceResponse(sourceType="kafka", configuration={}),
                PUBLIC_API_S3_DESTINATION,
            )
        assert len(edges) == 1
        assert edges[0].edge.fromEntity.type == "topic"
        assert edges[0].edge.toEntity.type == "container"

    def test_s3_source_to_elasticsearch_yields_container_to_search_index(self, airbyte_source):
        airbyte_source.source_config.lineageInformation = LineageInformation(searchServiceNames=["es_svc"])
        airbyte_source.metadata.get_by_name.side_effect = _route_get_by_name({SearchIndex: _stub(SEARCH_ID)})
        airbyte_source.metadata.es_search_container_by_path.return_value = [MOCK_CONTAINER]
        with patch("metadata.ingestion.source.pipeline.airbyte.resolvers.fqn.build", return_value="es_svc.pokemon"):
            edges = self._lineage(
                airbyte_source,
                AirbyteSourceResponse(sourceType="s3", configuration={"bucket": "om28591-airbyte-dest"}),
                AirbyteDestinationResponse(destinationType="elasticsearch", configuration={}),
            )
        assert len(edges) == 1
        assert edges[0].edge.fromEntity.type == "container"
        assert edges[0].edge.toEntity.type == "searchIndex"

    def test_warehouse_source_to_s3_yields_table_to_container(self, airbyte_source):
        airbyte_source.source_config.lineageInformation = LineageInformation(
            dbServiceNames=["warehouse"], storageServiceNames=["om28591-minio-storage"]
        )
        airbyte_source.metadata.get_by_name.side_effect = _route_get_by_name({Table: _stub(TABLE_ID)})
        airbyte_source.metadata.es_search_container_by_path.return_value = [MOCK_CONTAINER]
        airbyte_source.resolve_table = MagicMock(return_value=_stub(TABLE_ID))
        edges = self._lineage(
            airbyte_source,
            AirbyteSourceResponse(sourceType="redshift", configuration={"database": "db"}),
            PUBLIC_API_S3_DESTINATION,
        )
        assert len(edges) == 1
        assert edges[0].edge.fromEntity.type == "table"
        assert edges[0].edge.toEntity.type == "container"

    def test_supported_source_without_service_names_drops_edge(self, airbyte_source):
        """Kafka is a supported type; with no messagingServiceNames it drops the edge rather
        than anchoring on the pipeline (the pipeline must not be shown as a terminal node)."""
        airbyte_source.metadata.es_search_container_by_path.return_value = [MOCK_CONTAINER]
        edges = self._lineage(
            airbyte_source,
            AirbyteSourceResponse(sourceType="kafka", configuration={}),
            PUBLIC_API_S3_DESTINATION,
        )
        assert edges == []

    def test_supported_destination_not_ingested_drops_edge(self, airbyte_source):
        """gitar #1: a supported relational destination merely not ingested in OM must NOT
        emit a spurious source -> pipeline edge — the whole edge is dropped."""
        airbyte_source.source_config.lineageInformation = LineageInformation(dbServiceNames=["pg"])
        # Source (postgres) resolves; destination (postgres) FQN builds but entity is absent.
        airbyte_source.metadata.get_by_name.side_effect = _route_get_by_name({Table: None})
        airbyte_source.resolve_table = MagicMock(return_value=None)
        edges = self._lineage(
            airbyte_source,
            AirbyteSourceResponse(sourceType="postgres", configuration={"database": "db"}),
            AirbyteDestinationResponse(destinationType="postgres", configuration={"database": "db"}),
        )
        assert edges == []

    def test_unmapped_source_does_not_match_api_collection(self, airbyte_source):
        """gitar #2: an unlisted DB type with apiServiceNames set + a same-named collection must
        NOT produce an apiCollection edge. (Snowflake is mapped, so it never reaches the API path.)"""
        airbyte_source.source_config.lineageInformation = LineageInformation(
            apiServiceNames=["om28591-pokeapi"], storageServiceNames=["om28591-minio-storage"]
        )
        airbyte_source.metadata.get_by_name.side_effect = _route_get_by_name({Table: None})
        airbyte_source.metadata.es_search_container_by_path.return_value = [MOCK_CONTAINER]
        airbyte_source.metadata.es_search_from_fqn.return_value = [MOCK_API_COLLECTION]
        airbyte_source.resolve_table = MagicMock(return_value=None)
        edges = self._lineage(
            airbyte_source,
            AirbyteSourceResponse(sourceType="snowflake", configuration={"database": "db"}),
            PUBLIC_API_S3_DESTINATION,
        )
        # Snowflake source is supported-but-not-found -> whole edge dropped, never apiCollection.
        assert edges == []


class TestApiDestinationResolution:
    """
    An API destination resolves to its apiCollection, exactly like an API source. The earlier
    single-endpoint fan-out worked around server bug #33448, which is fixed.
    """

    def _lineage(self, airbyte_source, collections, api_services=("om28591-pokeapi",)):
        airbyte_source.source_config.lineageInformation = LineageInformation(apiServiceNames=list(api_services))
        airbyte_source.client.get_source.return_value = AirbyteSourceResponse(
            sourceType="s3", configuration={"bucket": "om28591-airbyte-dest"}
        )
        airbyte_source.client.get_destination.return_value = AirbyteDestinationResponse(
            destinationType="hubspot", configuration={}
        )
        airbyte_source.metadata.es_search_container_by_path.return_value = [MOCK_CONTAINER]
        airbyte_source.metadata.es_search_from_fqn.return_value = collections
        return [
            either.right
            for either in airbyte_source.yield_pipeline_lineage_details(
                AirbytePipelineDetails(workspace=AirbyteWorkspace(workspaceId="ws-1"), connection=PUBLIC_API_CONNECTION)
            )
        ]

    def test_emits_container_to_api_collection(self, airbyte_source):
        edges = self._lineage(airbyte_source, [MOCK_API_COLLECTION])

        assert len(edges) == 1
        assert edges[0].edge.fromEntity.type == "container"
        assert edges[0].edge.toEntity.type == "apiCollection"
        assert str(edges[0].edge.toEntity.id.root) == API_COLLECTION_ID

    def test_endpoints_are_never_searched(self, airbyte_source):
        """The endpoint fan-out is gone; a stream maps to a collection, nothing else."""
        self._lineage(airbyte_source, [MOCK_API_COLLECTION])

        searched = {
            call.kwargs.get("entity_type") for call in airbyte_source.metadata.es_search_from_fqn.call_args_list
        }
        assert APIEndpoint not in searched

    def test_ambiguous_collection_anchors_on_pipeline(self, airbyte_source):
        """Two same-named collections in the configured services stay unresolved."""
        edges = self._lineage(
            airbyte_source,
            [MOCK_API_COLLECTION, MOCK_OTHER_API_COLLECTION],
            api_services=("om28591-pokeapi", "unrelated_api_service"),
        )

        assert len(edges) == 1
        assert edges[0].edge.fromEntity.type == "container"
        assert edges[0].edge.toEntity.type == "pipeline"


DB_SERVICE_ID = "66666666-6666-4666-8666-666666666666"


def _db_service(name, config):
    return DatabaseService(
        id=DB_SERVICE_ID,
        name=name,
        serviceType=DatabaseServiceType.Postgres,
        connection=DatabaseConnection(config=config) if config else None,
    )


class TestServiceClassDetection:
    """
    Which OpenMetadata level Airbyte's "database" value maps to is a property of the target
    service, not the connector: multi-database services declare `supportsDatabase`/`database`
    in their connection schema, single-database ones declare neither and ingest under a
    synthetic `default` database.
    """

    @pytest.mark.parametrize(
        ("config", "expected"),
        [
            (PostgresConnection(username="u", hostPort="h:5432", database="d"), True),
            (MysqlConnection(username="u", hostPort="h:3306"), False),
            # An unreadable connection says nothing about the service's class.
            (None, None),
        ],
    )
    def test_service_class_is_read_from_connection_field_presence(self, config, expected):
        metadata = MagicMock()
        metadata.get_by_name.return_value = _db_service("svc", config)
        assert service_supports_database(metadata, "svc") is expected

    def test_absent_service_is_undecided(self):
        metadata = MagicMock()
        metadata.get_by_name.return_value = None
        assert service_supports_database(metadata, "svc") is None

    def test_presence_not_truthiness(self):
        """A server can return the flag nulled; testing its truthiness would then classify a
        multi-database service as single-database and drop the database level."""
        config = PostgresConnection(username="u", hostPort="h:5432", database="d", supportsDatabase=None)
        assert not config.supportsDatabase
        metadata = MagicMock()
        metadata.get_by_name.return_value = _db_service("svc", config)
        assert service_supports_database(metadata, "svc") is True

    def test_bigquery_declares_the_flag_without_a_database_field(self):
        """BigQuery is multi-database but has no `database` field, so the check must accept
        either declaration."""
        fields = BigQueryConnection.model_fields
        assert "supportsDatabase" in fields
        assert "database" not in fields

    def test_each_service_keeps_its_own_class(self, airbyte_source):
        """A mixed list has no single right answer, so each service is classified on its own
        and searched with the shapes its own class allows."""
        airbyte_source.source_config.lineageInformation = LineageInformation(dbServiceNames=["pg", "my"])
        airbyte_source.metadata.get_by_name.side_effect = lambda entity=None, fqn=None, **_: {
            "pg": _db_service("pg", PostgresConnection(username="u", hostPort="h:5432", database="d")),
            "my": _db_service("my", MysqlConnection(username="u", hostPort="h:3306")),
        }.get(fqn)

        assert (airbyte_source.db_service_class("pg"), airbyte_source.db_service_class("my")) == (True, False)

    def test_the_class_is_resolved_once_per_service(self, airbyte_source):
        """Every stream needs the same answer, so the server is asked once per service."""
        airbyte_source.source_config.lineageInformation = LineageInformation(dbServiceNames=["pg"])
        airbyte_source.metadata.get_by_name.return_value = _db_service(
            "pg", PostgresConnection(username="u", hostPort="h:5432", database="d")
        )

        assert [airbyte_source.db_service_class("pg") for _ in range(3)] == [True, True, True]
        assert airbyte_source.metadata.get_by_name.call_count == 1


class TestTableFqnCandidates:
    """The shapes tried for one set of Airbyte-reported levels, most specific first."""

    DETAILS = TableDetails(name="users", schema="public", database="app_db")

    def test_multi_database_service_uses_the_reported_levels(self):
        assert table_fqn_candidates(self.DETAILS, True) == [self.DETAILS]

    def test_single_database_service_moves_the_database_into_the_schema_slot(self):
        """Schema first, then the database — a single-database service can hold the real
        schema in either level, so neither is discarded."""
        assert table_fqn_candidates(self.DETAILS, False) == [
            TableDetails(name="users", schema="public", database=None),
            TableDetails(name="users", schema="app_db", database=None),
        ]

    def test_single_database_service_without_a_schema_falls_back_to_the_database(self):
        details = TableDetails(name="users", schema=None, database="app_db")
        assert table_fqn_candidates(details, False) == [TableDetails(name="users", schema="app_db", database=None)]

    def test_matching_levels_are_not_tried_twice(self):
        """The normal single-database shape: a MySQL source reports the same value as the
        stream namespace and as the config database."""
        details = TableDetails(name="users", schema="mydb", database="mydb")
        assert table_fqn_candidates(details, False) == [TableDetails(name="users", schema="mydb", database=None)]

    def test_config_database_is_still_tried_when_it_differs_from_the_namespace(self):
        """Regression guard for the pre-resolver behaviour, which put the *config* database in
        the schema slot for MySQL and ignored the stream namespace. The namespace is tried
        first now, but dropping the config database would lose lineage that used to resolve."""
        details = TableDetails(name="users", schema="stream_ns", database="mydb")
        assert table_fqn_candidates(details, False) == [
            TableDetails(name="users", schema="stream_ns", database=None),
            TableDetails(name="users", schema="mydb", database=None),
        ]

    def test_undecided_service_tries_multi_then_single(self):
        assert table_fqn_candidates(self.DETAILS, None) == [
            self.DETAILS,
            TableDetails(name="users", schema="public", database=None),
            TableDetails(name="users", schema="app_db", database=None),
        ]

    def test_no_database_never_duplicates_the_same_shape(self):
        details = TableDetails(name="users", schema="public", database=None)
        assert table_fqn_candidates(details, None) == [details]

    def test_multi_database_service_without_a_database_has_nothing_to_try(self):
        """A declared multi-database service whose connector reported no database cannot be
        qualified — no candidate, rather than a half-qualified guess."""
        assert table_fqn_candidates(TableDetails(name="users", schema=None, database=None), True) == []

    def test_undecided_service_needs_a_schema_for_the_database_qualified_shape(self):
        """`*.<database>.*.<table>` cannot match a single-database service (its FQN is
        `service.default.<database>.<table>`) and, against an undecided service, would instead
        match an unrelated service holding a database of that name."""
        details = TableDetails(name="users", schema=None, database="mydb")
        assert table_fqn_candidates(details, None) == [TableDetails(name="users", schema="mydb", database=None)]

    def test_known_multi_database_service_keeps_the_shape_without_a_schema(self):
        """A relational source that reported no stream namespace still resolves through
        `service.<database>.*.<table>` once the service is known to be multi-database."""
        details = TableDetails(name="users", schema=None, database="app_db")
        assert table_fqn_candidates(details, True) == [details]


class TestUnderQualifiedGuard:
    """The guard kills `*.*.*.<table>` without narrowing legitimate searches."""

    def test_refuses_a_table_with_neither_level(self, airbyte_source):
        assert airbyte_source.resolve_table(TableDetails(name="users", schema=None, database=None)) is None
        airbyte_source.metadata.es_search_from_fqn.assert_not_called()

    def _route(self, airbyte_source, config):
        """Only the service-class lookup resolves; no table exists, so every shape is tried."""
        airbyte_source.metadata.get_by_name.side_effect = lambda entity=None, fqn=None, **_: (
            _db_service(fqn, config) if entity is DatabaseService else None
        )

    def test_a_database_alone_is_still_searched(self, airbyte_source):
        """Postgres with no stream namespace has a database and must keep working."""
        airbyte_source.source_config.lineageInformation = LineageInformation(dbServiceNames=["pg"])
        self._route(airbyte_source, PostgresConnection(username="u", hostPort="h:5432", database="d"))
        airbyte_source.resolve_table(TableDetails(name="users", schema=None, database="app_db"))

        searched = [
            call.kwargs.get("fqn_search_string")
            for call in airbyte_source.metadata.es_search_from_fqn.call_args_list
            if call.kwargs.get("entity_type") is Table
        ]
        assert "pg.app_db.*.users" in searched

    def test_a_schema_alone_is_still_searched(self, airbyte_source):
        airbyte_source.source_config.lineageInformation = LineageInformation(dbServiceNames=["my"])
        self._route(airbyte_source, MysqlConnection(username="u", hostPort="h:3306"))
        airbyte_source.resolve_table(TableDetails(name="users", schema="app_db", database=None))

        searched = [
            call.kwargs.get("fqn_search_string")
            for call in airbyte_source.metadata.es_search_from_fqn.call_args_list
            if call.kwargs.get("entity_type") is Table
        ]
        assert "my.*.app_db.users" in searched


class TestBigQuerySourceKeys:
    """BigQuery names its levels the same way on both sides of a connection."""

    def test_source_reads_project_id_and_dataset_id(self):
        details = get_source_table_details(
            AirbyteStream(name="pokemon", namespace="ignored_namespace"),
            AirbyteSourceResponse(
                sourceType="bigquery",
                configuration={"project_id": "om-proj", "dataset_id": "om_ds"},
            ),
        )
        assert (details.database, details.schema) == ("om-proj", "om_ds")

    def test_source_falls_back_to_the_stream_namespace_without_a_dataset(self):
        details = get_source_table_details(
            AirbyteStream(name="pokemon", namespace="ns_ds"),
            AirbyteSourceResponse(sourceType="bigquery", configuration={"project_id": "om-proj"}),
        )
        assert (details.database, details.schema) == ("om-proj", "ns_ds")

    def test_display_name_type_uses_the_same_aliases(self):
        """The internal API reports "BigQuery"; the public API reports "bigquery"."""
        details = get_destination_table_details(
            AirbyteStream(name="pokemon"),
            AirbyteDestinationResponse(
                destinationName="BigQuery",
                connectionConfiguration={"project_id": "om-proj", "dataset_id": "om_ds"},
            ),
        )
        assert (details.database, details.schema) == ("om-proj", "om_ds")


class TestPerServiceTableResolution:
    """
    `fqn.build` returns a *constructed* FQN whenever service, database and schema are all
    present, even when Elasticsearch matched nothing, so a resolver that accepts the first
    service's answer never reaches the second.
    """

    DETAILS = TableDetails(name="users", schema="public", database="app_db")

    def _route(self, airbyte_source, classes, tables):
        """Classify each service, and let only `tables` resolve to an entity."""

        def _get_by_name(entity=None, fqn=None, **_):
            if entity is DatabaseService:
                config = (
                    PostgresConnection(username="u", hostPort="h:5432", database="d")
                    if classes[fqn]
                    else MysqlConnection(username="u", hostPort="h:3306")
                )
                return _db_service(fqn, config)
            if entity is Table:
                return tables.get(fqn)
            return None

        airbyte_source.metadata.get_by_name.side_effect = _get_by_name

    def test_falls_through_to_a_later_service(self, airbyte_source):
        """The table lives in the second service; the first must not swallow the lookup."""
        airbyte_source.source_config.lineageInformation = LineageInformation(dbServiceNames=["first", "second"])
        self._route(
            airbyte_source,
            classes={"first": True, "second": True},
            tables={"second.app_db.public.users": _stub(TABLE_ID)},
        )

        entity = airbyte_source.resolve_table(self.DETAILS)

        assert entity is not None
        assert entity.id == TABLE_ID

    def test_each_service_is_searched_with_its_own_shapes(self, airbyte_source):
        """A multi-database service keeps the database level; a single-database one drops it."""
        airbyte_source.source_config.lineageInformation = LineageInformation(dbServiceNames=["multi", "single"])
        self._route(airbyte_source, classes={"multi": True, "single": False}, tables={})

        airbyte_source.resolve_table(self.DETAILS)

        searched = [
            call.kwargs.get("fqn_search_string")
            for call in airbyte_source.metadata.es_search_from_fqn.call_args_list
            if call.kwargs.get("entity_type") is Table
        ]
        assert "multi.app_db.public.users" in searched
        assert "single.*.public.users" in searched
        # The single-database service must never be searched with a database level.
        assert "single.app_db.public.users" not in searched

    def test_no_service_resolves_to_no_table(self, airbyte_source):
        airbyte_source.source_config.lineageInformation = LineageInformation(dbServiceNames=["a", "b"])
        self._route(airbyte_source, classes={"a": True, "b": False}, tables={})

        assert airbyte_source.resolve_table(self.DETAILS) is None

    def test_two_services_matching_at_the_same_rank_resolve_to_nothing(self, airbyte_source):
        """
        Equal rank means the reported levels do not separate the two readings, so neither can
        be shown to be the right one. Emit nothing instead of picking by configured order.
        """
        airbyte_source.source_config.lineageInformation = LineageInformation(dbServiceNames=["a", "b"])
        self._route(
            airbyte_source,
            classes={"a": True, "b": True},
            tables={
                "a.app_db.public.users": _stub(TABLE_ID, "a.app_db.public.users"),
                "b.app_db.public.users": _stub(OTHER_TABLE_ID, "b.app_db.public.users"),
            },
        )

        assert airbyte_source.resolve_table(self.DETAILS) is None

    def test_a_named_schema_outranks_an_open_one_in_an_earlier_service(self, airbyte_source):
        """
        A connector that reports no schema leaves that level open, so the built FQN matches
        any schema of the named database. Searching services in configured order let such a
        shape win in the first service before the second was tried with a shape that names
        the schema -- which is how a MySQL destination (database `dstdb`, no schema) resolved
        onto an unrelated Postgres table in `dstdb.warehouse`.
        """
        airbyte_source.source_config.lineageInformation = LineageInformation(dbServiceNames=["multi", "single"])
        self._route(airbyte_source, classes={"multi": True, "single": False}, tables={})

        airbyte_source.resolve_table(TableDetails(name="users", schema=None, database="app_db"))

        searched = [
            call.kwargs.get("fqn_search_string")
            for call in airbyte_source.metadata.es_search_from_fqn.call_args_list
            if call.kwargs.get("entity_type") is Table
        ]
        assert searched.index("single.*.app_db.users") < searched.index("multi.app_db.*.users")


class TestTruncatedSearchGuards:
    """
    Both ambiguity guards call an ometa search helper that defaults to `size=10`. A cap smaller
    than the number of same-named entities turns an ambiguous match into a confident wrong edge,
    so the search asks for ES_MATCH_LIMIT and treats a full page as undecidable.
    """

    def _lineage(self, airbyte_source):
        return list(
            airbyte_source.yield_pipeline_lineage_details(
                AirbytePipelineDetails(workspace=AirbyteWorkspace(workspaceId="ws-1"), connection=PUBLIC_API_CONNECTION)
            )
        )

    def test_collection_search_asks_for_the_full_limit(self, airbyte_source):
        airbyte_source.source_config.lineageInformation = LineageInformation(apiServiceNames=["om28591-pokeapi"])
        airbyte_source.metadata.es_search_container_by_path.return_value = [MOCK_CONTAINER]
        airbyte_source.metadata.es_search_from_fqn.return_value = [MOCK_API_COLLECTION]

        self._lineage(airbyte_source)

        sizes = {
            call.kwargs.get("size")
            for call in airbyte_source.metadata.es_search_from_fqn.call_args_list
            if call.kwargs.get("entity_type") is APICollection
        }
        assert sizes == {ES_MATCH_LIMIT}

    def test_saturated_collection_search_yields_no_api_edge(self, airbyte_source):
        """A full page proves only that the rest did not fit, never that the match is unique."""
        airbyte_source.source_config.lineageInformation = LineageInformation(apiServiceNames=["om28591-pokeapi"])
        airbyte_source.metadata.es_search_container_by_path.return_value = [MOCK_CONTAINER]
        # Every hit but one belongs to another service, so filtering would leave exactly one.
        airbyte_source.metadata.es_search_from_fqn.return_value = [MOCK_API_COLLECTION] + [
            MOCK_OTHER_API_COLLECTION
        ] * (ES_MATCH_LIMIT - 1)

        edges = [either.right for either in self._lineage(airbyte_source)]

        assert len(edges) == 1
        assert edges[0].edge.fromEntity.type == "pipeline"
        assert edges[0].edge.toEntity.type == "container"

    def test_container_search_asks_for_the_full_limit(self, airbyte_source):
        airbyte_source.metadata.es_search_container_by_path.return_value = [MOCK_CONTAINER]

        self._lineage(airbyte_source)

        sizes = {call.kwargs.get("size") for call in airbyte_source.metadata.es_search_container_by_path.call_args_list}
        assert sizes == {ES_MATCH_LIMIT}

    def test_saturated_container_search_yields_no_edge(self, airbyte_source):
        """Same-service duplicates would otherwise pass the cross-service ambiguity check."""
        airbyte_source.metadata.es_search_container_by_path.return_value = [MOCK_CONTAINER] * ES_MATCH_LIMIT

        assert self._lineage(airbyte_source) == []


MOCK_SECOND_STORAGE_SERVICE_REF = EntityReference(
    id="7c7c7c7c-3333-4444-8555-666677778888",
    type="storageService",
    name="om28591-minio-storage-replica",
)

# The same bucket and prefix ingested a second time under a different storage service.
MOCK_DUPLICATE_CONTAINER = Container(
    id="5b5b5b5b-4444-4555-8666-777788889999",
    name="api_data/pokemon",
    fullyQualifiedName="om28591-minio-storage-replica.om28591-airbyte-dest.api_data/pokemon",
    service=MOCK_SECOND_STORAGE_SERVICE_REF,
)


class TestContainerServiceAmbiguity:
    """
    One S3 path can exist in more than one storage service. Neither candidate is more correct
    than the other, so the connector must emit nothing — including when storageServiceNames is
    set and lists both of them, which narrows the candidates without deciding between them.
    """

    def _lineage(self, airbyte_source):
        return list(
            airbyte_source.yield_pipeline_lineage_details(
                AirbytePipelineDetails(workspace=AirbyteWorkspace(workspaceId="ws-1"), connection=PUBLIC_API_CONNECTION)
            )
        )

    def test_unscoped_ambiguous_path_yields_no_edge(self, airbyte_source):
        airbyte_source.metadata.es_search_container_by_path.return_value = [
            MOCK_CONTAINER,
            MOCK_DUPLICATE_CONTAINER,
        ]

        assert self._lineage(airbyte_source) == []

    def test_scoped_ambiguous_path_yields_no_edge(self, airbyte_source):
        """Regression: the guard used to be skipped whenever storageServiceNames was set, so a
        bucket registered under two configured services resolved to whichever one ES returned
        first."""
        airbyte_source.source_config.lineageInformation = LineageInformation(
            storageServiceNames=["om28591-minio-storage", "om28591-minio-storage-replica"]
        )
        airbyte_source.metadata.es_search_container_by_path.return_value = [
            MOCK_CONTAINER,
            MOCK_DUPLICATE_CONTAINER,
        ]

        assert self._lineage(airbyte_source) == []

    def test_scoping_to_one_service_resolves_the_ambiguity(self, airbyte_source):
        """The documented way out: name a single service and the surviving candidate is unique."""
        airbyte_source.source_config.lineageInformation = LineageInformation(
            storageServiceNames=["om28591-minio-storage"]
        )
        airbyte_source.metadata.es_search_container_by_path.return_value = [
            MOCK_CONTAINER,
            MOCK_DUPLICATE_CONTAINER,
        ]

        edges = [either.right for either in self._lineage(airbyte_source)]

        assert len(edges) == 1
        assert edges[0].edge.toEntity.type == "container"
        assert str(edges[0].edge.toEntity.id.root) == CONTAINER_ID


class TestStreamParsingRobustness:
    """
    `configurations.streams` is filtered before validation so one malformed entry cannot fail
    the whole connection. The filter must not also discard well-formed ones.
    """

    def test_response_dicts_are_parsed(self):
        configurations = AirbyteConnectionConfigurations(streams=[{"name": "pokemon", "namespace": "ns"}])
        assert configurations.streams == [AirbyteStream(name="pokemon", namespace="ns")]

    @pytest.mark.parametrize("entry", [{}, {"namespace": "ns"}, {"name": ""}, {"name": None}, None, "junk", 7])
    def test_entries_without_a_name_are_dropped(self, entry):
        assert AirbyteConnectionConfigurations(streams=[entry]).streams == []

    def test_already_built_streams_survive(self):
        """Regression: the filter tested `isinstance(item, dict)`, so an `AirbyteStream` — the
        one shape guaranteed to be valid — was dropped and `streams` came back empty with no
        error, the same silent loss this connector was fixed for."""
        stream = AirbyteStream(name="pokemon", namespace="ns")
        assert AirbyteConnectionConfigurations(streams=[stream]).streams == [stream]

    def test_a_malformed_entry_does_not_take_the_good_ones_with_it(self):
        configurations = AirbyteConnectionConfigurations(
            streams=[{"name": "users"}, {"name": ""}, AirbyteStream(name="orders"), None]
        )
        assert [stream.name for stream in configurations.streams] == ["users", "orders"]

    def test_resolved_streams_agree_across_both_input_shapes(self):
        def model(streams):
            return AirbyteConnectionModel(connectionId="c1", configurations={"streams": streams}).resolved_streams

        assert model([{"name": "pokemon"}]) == model([AirbyteStream(name="pokemon")])


class TestUnresolvedSideWarning:
    """
    A connection side that no resolver claims is reported once, after the streams have been
    tried — never once per stream, and never at all when the API resolver did claim it.
    """

    STREAMS: ClassVar[dict] = {
        "streams": [{"name": name} for name in ("users", "orders", "payments", "refunds", "carts")]
    }

    def _run(self, airbyte_source, caplog):
        connection = AirbyteConnectionModel(
            connectionId="c1", name="conn", sourceId="s1", destinationId="d1", configurations=self.STREAMS
        )
        with caplog.at_level(logging.WARNING, logger="metadata.Ingestion"):
            edges = list(
                airbyte_source.yield_pipeline_lineage_details(
                    AirbytePipelineDetails(workspace=AirbyteWorkspace(workspaceId="ws-1"), connection=connection)
                )
            )
        return edges, [record.getMessage() for record in caplog.records if record.levelname == "WARNING"]

    def _unknown_both_sides(self, airbyte_source):
        airbyte_source.client.get_source.return_value = AirbyteSourceResponse(sourceType="dynamodb", configuration={})
        airbyte_source.client.get_destination.return_value = AirbyteDestinationResponse(
            destinationType="dynamodb", configuration={}
        )

    def test_one_warning_per_side_not_per_stream(self, airbyte_source, caplog):
        self._unknown_both_sides(airbyte_source)

        edges, warnings = self._run(airbyte_source, caplog)

        assert edges == []
        assert len(warnings) == 2
        assert all("is not supported yet" in warning for warning in warnings)

    def test_with_api_service_names_the_count_does_not_grow_with_streams(self, airbyte_source, caplog):
        """Regression: the once-per-connection warning used to be skipped whenever
        apiServiceNames was set, leaving one `matched 0 API collections` warning per stream per
        side — five streams produced ten — none of which said the connector was unsupported."""
        airbyte_source.source_config.lineageInformation = LineageInformation(apiServiceNames=["om28591-pokeapi"])
        self._unknown_both_sides(airbyte_source)
        airbyte_source.metadata.es_search_from_fqn.return_value = []

        edges, warnings = self._run(airbyte_source, caplog)

        assert edges == []
        assert len(warnings) == 2
        assert all("matched no API collection" in warning for warning in warnings)

    def test_a_side_the_api_resolver_claims_is_not_reported(self, airbyte_source, caplog):
        """The source is an unmapped connector type, but apiServiceNames resolves it — calling
        that side unsupported would be wrong."""
        airbyte_source.source_config.lineageInformation = LineageInformation(apiServiceNames=["om28591-pokeapi"])
        airbyte_source.metadata.es_search_from_fqn.return_value = [MOCK_API_COLLECTION]
        airbyte_source.metadata.es_search_container_by_path.return_value = [MOCK_CONTAINER]

        edges, warnings = self._run(airbyte_source, caplog)

        assert len(edges) == 5
        assert warnings == []

    def test_an_ambiguous_stream_is_still_reported_per_stream(self, airbyte_source, caplog):
        """Ambiguity is a property of the individual stream name, so it stays per stream — only
        the `no match` case collapses to one line per side."""
        airbyte_source.source_config.lineageInformation = LineageInformation(
            apiServiceNames=["om28591-pokeapi", "unrelated_api_service"]
        )
        airbyte_source.metadata.es_search_from_fqn.return_value = [MOCK_API_COLLECTION, MOCK_OTHER_API_COLLECTION]
        airbyte_source.metadata.es_search_container_by_path.return_value = [MOCK_CONTAINER]

        _, warnings = self._run(airbyte_source, caplog)

        assert len([w for w in warnings if "matched 2 API collections" in w]) == 5


class TestDestinationEntityNaming:
    """
    A destination renames the stream on its way in, so the name to look up in OpenMetadata is
    never assumed to be ``stream.name``. Every rule here was read off the live connector source
    for the deployed image tag and confirmed against a real Airbyte 2.2.0 sync.

    The stream reaching a resolver on the destination side has already been through
    ``AirbyteConnectionModel.destination_stream``, so its name carries the connection prefix and
    its namespace is the one the connection resolved -- not the one the source reported.
    """

    NAMESPACED = AirbyteStream(name="products", namespace="shopdb")
    BARE = AirbyteStream(name="pokemon")

    def test_search_index_destination_prefixes_the_namespace(self):
        """`ElasticsearchWriteConfig.getIndexName()` prefixes a non-empty namespace; a real sync
        of shopdb.products with `namespaceDefinition: source` produced `shopdb_products`."""
        names = SearchIndexResolver()._entity_names(
            self.NAMESPACED, AirbyteDestinationResponse(destinationType="elasticsearch"), DESTINATION
        )
        assert names == ["shopdb_products"]

    def test_search_index_without_a_namespace_is_the_bare_stream(self):
        """The same sync with `namespaceDefinition: destination` wrote the bare `products`, so a
        resolved-away namespace must not leave the namespaced name as a candidate."""
        names = SearchIndexResolver()._entity_names(
            self.BARE, AirbyteDestinationResponse(destinationType="elasticsearch"), DESTINATION
        )
        assert names == ["pokemon"]

    def test_search_index_name_is_normalised_and_lower_cased(self):
        """getIndexName() lower-cases the namespace and runs the stream name through
        StandardNameTransformer before lower-casing it."""
        names = SearchIndexResolver()._entity_names(
            AirbyteStream(name="Order Items", namespace="ShopDB"),
            AirbyteDestinationResponse(destinationType="elasticsearch"),
            DESTINATION,
        )
        assert names == ["shopdb_order_items"]

    def test_search_index_source_reads_the_index_named_by_the_stream(self):
        names = SearchIndexResolver()._entity_names(
            self.NAMESPACED, AirbyteSourceResponse(sourceType="elasticsearch"), SOURCE
        )
        assert names == ["products"]

    @pytest.mark.parametrize(
        ("pattern", "expected"),
        [
            ("{stream}", ["products"]),
            ("{namespace}.{stream}", ["shopdb_products"]),
            ("{namespace}_{stream}_v2", ["shopdb_products_v2"]),
            ("fixed.topic", ["fixed_topic"]),
        ],
    )
    def test_topic_destination_renders_its_pattern(self, pattern, expected):
        """`KafkaRecordConsumer.buildTopicMap()` renders the pattern and runs the result through
        StandardNameTransformer, so every character outside [A-Za-z0-9_] becomes `_`. A real sync
        with `{namespace}.{stream}` over shopdb.products produced the topic `shopdb_products`."""
        names = TopicResolver()._entity_names(
            self.NAMESPACED,
            AirbyteDestinationResponse(destinationType="kafka", configuration={"topic_pattern": pattern}),
            DESTINATION,
        )
        assert names == expected

    def test_topic_destination_without_a_pattern_falls_back_to_the_stream(self):
        """destination-kafka 0.1.11 declares no default for `topic_pattern`, so with none
        configured nothing is derivable and the stream name is the only key left."""
        names = TopicResolver()._entity_names(
            self.NAMESPACED, AirbyteDestinationResponse(destinationType="kafka", configuration={}), DESTINATION
        )
        assert names == ["products"]

    def test_topic_source_reads_the_topic_named_by_the_stream(self):
        """A Kafka source turns each topic into a stream, so no pattern is involved."""
        names = TopicResolver()._entity_names(
            self.BARE, AirbyteSourceResponse(sourceType="kafka", configuration={}), SOURCE
        )
        assert names == ["pokemon"]

    def test_a_pattern_needing_a_namespace_the_stream_lacks_renders_it_empty(self):
        """buildTopicMap() substitutes an empty string for a missing namespace rather than
        falling back to the stream name, so `{namespace}.{stream}` writes `_pokemon`. Looking up
        the bare `pokemon` instead would attach lineage to a topic this connection never wrote."""
        assert render_stream_pattern("{namespace}.{stream}", self.BARE) == ".pokemon"
        names = TopicResolver()._entity_names(
            self.BARE,
            AirbyteDestinationResponse(
                destinationType="kafka", configuration={"topic_pattern": "{namespace}.{stream}"}
            ),
            DESTINATION,
        )
        assert names == ["_pokemon"]

    def test_the_resolved_name_is_the_only_candidate(self, airbyte_source):
        """A destination writes exactly one name per stream, so a miss is no edge rather than a
        second guess at a same-named entity the connection never wrote."""
        airbyte_source.source_config.lineageInformation = LineageInformation(searchServiceNames=["es_svc"])
        airbyte_source.metadata.get_by_name.side_effect = lambda entity=None, fqn=None, **_: (
            _stub(SEARCH_ID) if entity is SearchIndex and fqn == "es_svc.shopdb_products" else None
        )
        with patch(
            "metadata.ingestion.source.pipeline.airbyte.resolvers.fqn.build",
            side_effect=lambda **kw: f"{kw['service_name']}.{kw['search_index_name']}",
        ):
            ref = SearchIndexResolver().resolve(
                airbyte_source,
                self.NAMESPACED,
                AirbyteDestinationResponse(destinationType="elasticsearch"),
                DESTINATION,
                "pipe",
            )
            assert ref is not None
            assert str(ref.id.root) == SEARCH_ID

            # The bare stream name resolves in the same service, and is still not taken.
            assert (
                SearchIndexResolver().resolve(
                    airbyte_source,
                    self.BARE.model_copy(update={"name": "shopdb_products"}),
                    AirbyteDestinationResponse(destinationType="elasticsearch"),
                    SOURCE,
                    "pipe",
                )
                is not None
            )


class TestConnectionResolvedDestinationStream:
    """
    Airbyte decides the destination's namespace and stream name on the connection, not on the
    stream the source reported. Every case below was confirmed against a real Airbyte 2.2.0
    sync of the same MySQL stream `shopdb.products` into destination-elasticsearch 0.2.0.
    """

    STREAM = AirbyteStream(name="products", namespace="shopdb")

    @staticmethod
    def _connection(**kwargs) -> AirbyteConnectionModel:
        return AirbyteConnectionModel(connectionId="conn", **kwargs)

    @pytest.mark.parametrize(
        ("namespace_definition", "namespace_format", "expected"),
        [
            ("source", None, "shopdb"),
            ("destination", None, None),
            # `destination` is the API default, so an absent value must not be read as `source`.
            (None, None, None),
            # A blank custom format behaves like `destination`, per the public API schema.
            ("custom_format", None, None),
            ("custom_format", "${SOURCE_NAMESPACE}", "shopdb"),
            ("custom_format", "warehouse", "warehouse"),
            # The internal config API spells the same value without the underscore.
            ("customformat", None, None),
            ("customformat", "${SOURCE_NAMESPACE}", "shopdb"),
            ("customformat", "warehouse", "warehouse"),
        ],
    )
    def test_destination_namespace(self, namespace_definition, namespace_format, expected):
        connection = self._connection(namespaceDefinition=namespace_definition, namespaceFormat=namespace_format)
        assert connection.destination_namespace(self.STREAM) == expected

    def test_namespace_definition_source_keeps_the_namespaced_index(self):
        """A real sync of this connection created the index `shopdb_products`."""
        stream = self._connection(namespaceDefinition="source").destination_stream(self.STREAM)
        names = SearchIndexResolver()._entity_names(
            stream, AirbyteDestinationResponse(destinationType="elasticsearch"), DESTINATION
        )
        assert names == ["shopdb_products"]

    def test_namespace_definition_destination_drops_the_namespace(self):
        """The same stream on a `destination` connection wrote the bare index `products`."""
        stream = self._connection(namespaceDefinition="destination").destination_stream(self.STREAM)
        names = SearchIndexResolver()._entity_names(
            stream, AirbyteDestinationResponse(destinationType="elasticsearch"), DESTINATION
        )
        assert names == ["products"]

    def test_prefix_is_prepended_to_the_destination_name(self):
        """Setting `prefix: ab_` on a real connection made the destination write `ab_products`."""
        stream = self._connection(namespaceDefinition="destination", prefix="ab_").destination_stream(self.STREAM)
        assert stream.name == "ab_products"
        names = SearchIndexResolver()._entity_names(
            stream, AirbyteDestinationResponse(destinationType="elasticsearch"), DESTINATION
        )
        assert names == ["ab_products"]

    def test_prefix_reaches_the_topic_pattern(self):
        """The prefix is applied before the destination renders `{stream}`."""
        stream = self._connection(namespaceDefinition="source", prefix="ab_").destination_stream(self.STREAM)
        names = TopicResolver()._entity_names(
            stream,
            AirbyteDestinationResponse(
                destinationType="kafka", configuration={"topic_pattern": "{namespace}.{stream}"}
            ),
            DESTINATION,
        )
        assert names == ["shopdb_ab_products"]

    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            # A real sync with `prefix: "ab prod "` wrote to `curated/ab_prod_products`.
            ("ab prod products", "ab_prod_products"),
            ("products", "products"),
            # Case is preserved: toS3SafeCharacters narrows the character set, it does not
            # lower-case, unlike the Elasticsearch and Kafka transforms.
            ("Products", "Products"),
            ("Order Items", "Order_Items"),
            ("caf\u00e9", "cafe"),
            ("a#b", "a_b"),
            # Already inside Airbyte's S3-safe set, so untouched.
            ("x-y", "x-y"),
            ("p.q", "p.q"),
        ],
    )
    def test_s3_path_segments_are_sanitised(self, raw, expected):
        """`ObjectStoragePathFactory` resolves `${NAMESPACE}` and `${STREAM_NAME}` through
        `Transformations.toS3SafeCharacters`, so the written path is not the raw stream name."""
        assert to_s3_safe_characters(raw) == expected

    def test_s3_destination_path_uses_the_sanitised_names(self):
        stream = self._connection(namespaceDefinition="destination", prefix="ab prod ").destination_stream(self.STREAM)
        path = get_destination_container_path(
            stream,
            AirbyteDestinationResponse(
                destinationType="s3",
                configuration={"s3_bucket_name": "omlin-lake2", "s3_bucket_path": "curated"},
            ),
        )
        assert path == "s3://omlin-lake2/curated/ab_prod_products"

    def test_the_source_side_stream_is_untouched(self):
        """Only the destination renames streams; the source reads what it reported."""
        connection = self._connection(namespaceDefinition="destination", prefix="ab_")
        assert connection.destination_stream(self.STREAM) != self.STREAM
        assert self.STREAM.name == "products"
        assert self.STREAM.namespace == "shopdb"
