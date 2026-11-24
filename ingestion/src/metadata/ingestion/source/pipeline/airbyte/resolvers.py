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
Centralized entity resolution for Airbyte lineage.

Each Airbyte source/destination connector type maps to one OpenMetadata entity kind
(table, container, topic, searchIndex, apiCollection). A single registry
(``CONNECTOR_RESOLVERS``) maps a connector type to the resolver that knows how to turn a
stream into an ``EntityReference``. Adding a new connector type is a registry entry;
adding a new entity kind is one ``EntityResolver`` subclass — no new branches in
``metadata.py``.

``apiCollection`` resolves the same way on both sides of a connection. An earlier revision
routed API *destinations* to the collection's single ``apiEndpoint`` because a downstream
``apiCollection`` edge returned HTTP 500; that was server bug #33448 (the ADD_UPDATE_LINEAGE
script dereferenced ``upstreamLineage`` on target docs whose index does not seed it), fixed
in 1465ab330af, not a rule about apiCollection.
"""

from abc import ABC, abstractmethod
from collections.abc import Iterable
from typing import TYPE_CHECKING, Any, cast

from metadata.generated.schema.entity.data.apiCollection import APICollection
from metadata.generated.schema.entity.data.searchIndex import SearchIndex
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.utils import model_str
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

from .constants import (  # noqa: TID252
    DESTINATION_TYPE_LOOKUP,
    ES_MATCH_LIMIT,
    KAFKA_TOPIC_PATTERN_KEY,
    MESSAGING_CONNECTOR_TYPES,
    S3_CONNECTOR_TYPES,
    SEARCH_CONNECTOR_TYPES,
    SOURCE_TYPE_LOOKUP,
)
from .models import (  # noqa: TID252
    AirbyteDestinationResponse,
    AirbyteSourceResponse,
    AirbyteStream,
)
from .utils import (  # noqa: TID252
    get_destination_container_path,
    get_destination_table_details,
    get_source_container_path,
    get_source_table_details,
    normalize_airbyte_name,
    render_stream_pattern,
)

if TYPE_CHECKING:
    from .metadata import AirbyteSource  # noqa: TID252

logger = ingestion_logger()

SOURCE = "source"
DESTINATION = "destination"

Connection = AirbyteSourceResponse | AirbyteDestinationResponse


class EntityResolver(ABC):
    """Resolves a stream to the OpenMetadata entity for one connector kind."""

    om_type: str

    @abstractmethod
    def resolve(
        self,
        source: "AirbyteSource",
        stream: AirbyteStream,
        connection: Connection,
        direction: str,
        pipeline_name: str,
    ) -> EntityReference | None:
        """Return the EntityReference for this stream, or None when unresolved."""


class TableResolver(EntityResolver):
    """Relational databases and warehouses → OpenMetadata ``table``."""

    om_type = "table"

    def resolve(
        self,
        source: "AirbyteSource",
        stream: AirbyteStream,
        connection: Connection,
        direction: str,
        pipeline_name: str,
    ) -> EntityReference | None:
        # The caller pairs `connection` with `direction`: source_connection only ever
        # arrives with SOURCE, destination_connection only ever arrives with DESTINATION.
        details = (
            get_source_table_details(stream, cast("AirbyteSourceResponse", connection))
            if direction == SOURCE
            else get_destination_table_details(stream, cast("AirbyteDestinationResponse", connection))
        )
        if not details:
            return None

        entity = source.resolve_table(details)
        if entity:
            return EntityReference(id=entity.id, type="table")

        logger.warning(
            "Airbyte lineage [%s]: table [%s].[%s].[%s] (type %s) not found in OpenMetadata",
            pipeline_name,
            details.database or "*",
            details.schema,
            details.name,
            connection.resolved_type,
        )
        return None


class ContainerResolver(EntityResolver):
    """Object stores (S3) → OpenMetadata ``container``, resolved by path."""

    om_type = "container"

    def resolve(
        self,
        source: "AirbyteSource",
        stream: AirbyteStream,
        connection: Connection,
        direction: str,
        pipeline_name: str,
    ) -> EntityReference | None:
        # Same caller-guaranteed pairing as TableResolver.resolve.
        container_path = (
            get_source_container_path(stream, cast("AirbyteSourceResponse", connection))
            if direction == SOURCE
            else get_destination_container_path(stream, cast("AirbyteDestinationResponse", connection))
        )
        if not container_path:
            return None
        return source._get_container_entity_reference(container_path, pipeline_name)


class _ServiceScopedResolver(EntityResolver):
    """
    Base for kinds keyed on the stream name and scoped by a service-names list
    (topic/searchIndex). Requires the list so a stream name never matches a
    same-named entity in an unrelated service.
    """

    def _service_names(self, source: "AirbyteSource") -> list[str]:
        raise NotImplementedError

    def _entity_names(self, stream: AirbyteStream, connection: Connection, direction: str) -> list[str]:
        """The names this stream could carry in the target service, most likely first."""
        raise NotImplementedError

    def _build_fqn(self, source: "AirbyteSource", service_name: str, entity_name: str) -> str | None:
        raise NotImplementedError

    def _entity_type(self):
        raise NotImplementedError

    def resolve(
        self,
        source: "AirbyteSource",
        stream: AirbyteStream,
        connection: Connection,
        direction: str,
        pipeline_name: str,
    ) -> EntityReference | None:
        service_names = self._service_names(source)
        if not service_names:
            logger.debug(
                "Skipping %s lineage for stream [%s] in pipeline [%s]: no service names configured",
                self.om_type,
                stream.name,
                pipeline_name,
            )
            return None

        entity_names = self._entity_names(stream, connection, direction)
        matches: dict[str, Any] = {}
        for service_name in service_names:
            for entity_name in entity_names:
                entity_fqn = self._build_fqn(source, service_name, entity_name)
                entity = source.metadata.get_by_name(entity=self._entity_type(), fqn=entity_fqn) if entity_fqn else None
                if entity:
                    matches[model_str(entity.fullyQualifiedName)] = entity

        if len(matches) > 1:
            # The same rule the table and container guards apply: several services hold the
            # name and nothing in the stream separates them, so emit no edge rather than let
            # the order of the configured list decide.
            logger.warning(
                "Airbyte lineage [%s]: %s %s matches %s; skipping. Narrow the configured"
                " service names to disambiguate.",
                pipeline_name,
                self.om_type,
                entity_names,
                sorted(matches),
            )
            return None
        if matches:
            entity = next(iter(matches.values()))
            return EntityReference(id=entity.id, type=self.om_type)

        logger.warning(
            "Airbyte lineage [%s]: %s %s not found in services %s",
            pipeline_name,
            self.om_type,
            entity_names,
            service_names,
        )
        return None


class TopicResolver(_ServiceScopedResolver):
    """
    Message queues (Kafka) → OpenMetadata ``topic``.

    A Kafka *source* reads one topic per stream, so the stream name is the topic name. A Kafka
    *destination* names the topic from its own ``topic_pattern``, a free-form template over
    ``{namespace}`` and ``{stream}`` with no default (verified against destination-kafka
    0.1.11's spec), so the pattern is rendered rather than assumed.
    """

    om_type = "topic"

    def _service_names(self, source: "AirbyteSource") -> list[str]:
        return source.get_messaging_service_names()

    def _entity_type(self) -> type[Topic]:
        return Topic

    def _entity_names(self, stream: AirbyteStream, connection: Connection, direction: str) -> list[str]:
        if direction == SOURCE:
            return [stream.name]
        pattern = connection.resolved_configuration.get(KAFKA_TOPIC_PATTERN_KEY)
        if not pattern:
            # destination-kafka 0.1.11 declares no default for `topic_pattern`, so nothing is
            # derivable from it and the stream name is the only key left.
            return [stream.name]
        # `KafkaRecordConsumer.buildTopicMap()` renders the pattern and runs the result through
        # StandardNameTransformer, so the rendered-and-normalised name is the only topic written.
        # A bare stream name is a different topic that this connection never produced.
        return [normalize_airbyte_name(render_stream_pattern(pattern, stream))]

    def _build_fqn(self, source: "AirbyteSource", service_name: str, entity_name: str) -> str | None:
        return fqn.build(
            metadata=source.metadata,
            entity_type=Topic,
            service_name=service_name,
            topic_name=entity_name,
        )


class SearchIndexResolver(_ServiceScopedResolver):
    """
    Search stores (Elasticsearch) → OpenMetadata ``searchIndex``.

    destination-elasticsearch exposes no index-naming option (verified against 0.2.0's spec):
    it always writes ``<namespace>_<stream>``, falling back to the bare stream name when the
    source reports no namespace. Looking the index up by stream name alone therefore missed
    every namespaced stream, which is every relational source.
    """

    om_type = "searchIndex"

    def _service_names(self, source: "AirbyteSource") -> list[str]:
        return source.get_search_service_names()

    def _entity_type(self) -> type[SearchIndex]:
        return SearchIndex

    def _entity_names(self, stream: AirbyteStream, connection: Connection, direction: str) -> list[str]:
        if direction == SOURCE:
            return [stream.name]
        # `ElasticsearchWriteConfig.getIndexName()` (destination-elasticsearch 0.2.0) passes the
        # stream name through StandardNameTransformer and lower-cases it, then prefixes a
        # non-empty namespace, lower-cased and untransformed. The namespace here is the one the
        # connection resolved, which is empty whenever `namespaceDefinition` is `destination`.
        index_name = normalize_airbyte_name(stream.name).lower()
        if stream.namespace:
            index_name = f"{stream.namespace.lower()}_{index_name}"
        return [index_name]

    def _build_fqn(self, source: "AirbyteSource", service_name: str, entity_name: str) -> str | None:
        return fqn.build(
            metadata=source.metadata,
            entity_type=SearchIndex,
            service_name=service_name,
            search_index_name=entity_name,
        )


class ApiResolver(EntityResolver):
    """
    APIs → OpenMetadata ``apiCollection``, in either direction.

    Opt-in via ``apiServiceNames`` and only on an unambiguous match: an Airbyte API connector
    exposes no endpoint URL, so the stream name is the sole join key and a name that matches
    more than one collection is skipped rather than guessed.
    """

    om_type = "apiCollection"

    def resolve(
        self,
        source: "AirbyteSource",
        stream: AirbyteStream,
        connection: Connection,
        direction: str,
        pipeline_name: str,
    ) -> EntityReference | None:
        api_services = source.get_api_service_names()
        if not api_services:
            logger.debug(
                "Skipping API lineage for stream [%s] in pipeline [%s]:"
                " set lineageInformation.apiServiceNames to enable it",
                stream.name,
                pipeline_name,
            )
            return None

        collection = self._match_collection(source, stream, api_services, pipeline_name)
        if collection is None:
            return None

        logger.debug(
            "Resolved Airbyte %s stream [%s] to API collection [%s]",
            direction,
            stream.name,
            model_str(collection.fullyQualifiedName),
        )
        return EntityReference(id=collection.id, type="apiCollection")

    def _match_collection(
        self, source: "AirbyteSource", stream: AirbyteStream, api_services: list[str], pipeline_name: str
    ) -> APICollection | None:
        hits = (
            source.metadata.es_search_from_fqn(
                entity_type=APICollection,
                fqn_search_string=f"*.{stream.name}",
                size=ES_MATCH_LIMIT,
            )
            or []
        )
        if len(hits) >= ES_MATCH_LIMIT:
            # A full page means the search was truncated, so a single survivor after filtering
            # would only prove the rest did not fit — not that the match is unambiguous.
            logger.warning(
                "While extracting lineage: [%s], stream [%s] matched at least %d API collections;"
                " skipping rather than picking from a truncated search.",
                pipeline_name,
                stream.name,
                ES_MATCH_LIMIT,
            )
            return None

        collections = [
            collection
            for collection in hits
            if collection.service and model_str(collection.service.name) in api_services
        ]
        if len(collections) > 1:
            logger.warning(
                "While extracting lineage: [%s], stream [%s] matched %d API collections in the"
                " configured services; skipping. Narrow lineageInformation.apiServiceNames to"
                " disambiguate.",
                pipeline_name,
                stream.name,
                len(collections),
            )
            return None
        if not collections:
            # Not an ambiguity and usually not an API connector at all. The caller reports the
            # whole side once, instead of one warning per stream saying the same thing.
            logger.debug(
                "While extracting lineage: [%s], stream [%s] matched no API collection in %s",
                pipeline_name,
                stream.name,
                api_services,
            )
            return None
        return collections[0]


_TABLE_RESOLVER = TableResolver()
_CONTAINER_RESOLVER = ContainerResolver()
_TOPIC_RESOLVER = TopicResolver()
_SEARCH_RESOLVER = SearchIndexResolver()
API_RESOLVER = ApiResolver()


def _build_registry(table_types: Iterable[str]) -> dict[str, EntityResolver]:
    """One connector type → one resolver. Both display-name and slug keys are present."""
    registry: dict[str, EntityResolver] = dict.fromkeys(table_types, _TABLE_RESOLVER)
    registry.update(dict.fromkeys(S3_CONNECTOR_TYPES, _CONTAINER_RESOLVER))
    registry.update(dict.fromkeys(MESSAGING_CONNECTOR_TYPES, _TOPIC_RESOLVER))
    registry.update(dict.fromkeys(SEARCH_CONNECTOR_TYPES, _SEARCH_RESOLVER))
    return registry


# Airbyte ships connectors on one side only (MongoDB is a source, never a destination), so a
# shared registry would report a source-only type as a supported destination and silently drop
# the edge instead of anchoring it on the pipeline.
SOURCE_RESOLVERS: dict[str, EntityResolver] = _build_registry(SOURCE_TYPE_LOOKUP)
DESTINATION_RESOLVERS: dict[str, EntityResolver] = _build_registry(DESTINATION_TYPE_LOOKUP)


def get_resolver(resolved_type: str | None, direction: str) -> EntityResolver | None:
    """
    Resolver for a connector type on one side of a connection, or None when the type is not
    mapped to any entity kind there.

    A None return means "unknown connector": the caller then tries the opt-in API resolver
    and, failing that, anchors on the pipeline. Unknown types are deliberately NOT routed to
    the API resolver here — that would let an unmapped relational connector (Snowflake,
    BigQuery, …) match a same-named apiCollection when apiServiceNames is set.
    """
    if not resolved_type:
        return None
    registry = SOURCE_RESOLVERS if direction == SOURCE else DESTINATION_RESOLVERS
    return registry.get(resolved_type) or registry.get(resolved_type.lower())
