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
(table, container, topic, searchIndex, apiCollection/apiEndpoint). A single registry
(``CONNECTOR_RESOLVERS``) maps a connector type to the resolver that knows how to turn a
stream into an ``EntityReference``. Adding a new connector type is a registry entry;
adding a new entity kind is one ``EntityResolver`` subclass — no new branches in
``metadata.py``.

Direction rules baked into the resolvers:
- ``apiCollection`` resolves as an *upstream* node only (OpenMetadata rejects it as a
  downstream lineage target). For an API *destination* the resolver falls back to the
  collection's single ``apiEndpoint`` (safe fan-out: only when exactly one endpoint
  exists, so no ambiguous edges are invented).
"""

from abc import ABC, abstractmethod
from collections.abc import Iterable
from typing import TYPE_CHECKING, cast

from metadata.generated.schema.entity.data.apiCollection import APICollection
from metadata.generated.schema.entity.data.apiEndpoint import APIEndpoint
from metadata.generated.schema.entity.data.searchIndex import SearchIndex
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.utils import model_str
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

from .constants import (  # noqa: TID252
    DESTINATION_TYPE_LOOKUP,
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
    table_fqn_candidates,
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

        for candidate in table_fqn_candidates(details, source.db_service_supports_database):
            table_fqn = source._get_table_fqn(candidate)
            if not table_fqn:
                continue
            entity = source.metadata.get_by_name(entity=Table, fqn=table_fqn)
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

    def _build_fqn(self, source: "AirbyteSource", service_name: str, stream: AirbyteStream) -> str | None:
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

        for service_name in service_names:
            entity_fqn = self._build_fqn(source, service_name, stream)
            entity = source.metadata.get_by_name(entity=self._entity_type(), fqn=entity_fqn) if entity_fqn else None
            if entity:
                return EntityReference(id=entity.id, type=self.om_type)

        logger.warning(
            "Airbyte lineage [%s]: %s [%s] not found in services %s",
            pipeline_name,
            self.om_type,
            stream.name,
            service_names,
        )
        return None


class TopicResolver(_ServiceScopedResolver):
    """Message queues (Kafka) → OpenMetadata ``topic`` (topic name == stream name)."""

    om_type = "topic"

    def _service_names(self, source: "AirbyteSource") -> list[str]:
        return source.get_messaging_service_names()

    def _entity_type(self) -> type[Topic]:
        return Topic

    def _build_fqn(self, source: "AirbyteSource", service_name: str, stream: AirbyteStream) -> str | None:
        return fqn.build(
            metadata=source.metadata,
            entity_type=Topic,
            service_name=service_name,
            topic_name=stream.name,
        )


class SearchIndexResolver(_ServiceScopedResolver):
    """Search stores (Elasticsearch) → OpenMetadata ``searchIndex`` (index == stream name)."""

    om_type = "searchIndex"

    def _service_names(self, source: "AirbyteSource") -> list[str]:
        return source.get_search_service_names()

    def _entity_type(self) -> type[SearchIndex]:
        return SearchIndex

    def _build_fqn(self, source: "AirbyteSource", service_name: str, stream: AirbyteStream) -> str | None:
        return fqn.build(
            metadata=source.metadata,
            entity_type=SearchIndex,
            service_name=service_name,
            search_index_name=stream.name,
        )


class ApiResolver(EntityResolver):
    """
    APIs → ``apiCollection`` (upstream) or ``apiEndpoint`` (downstream).

    Opt-in via ``apiServiceNames`` and only on an unambiguous match. A stream name maps to
    a collection, so an API *destination* uses the collection's single endpoint (safe
    fan-out) because OpenMetadata rejects apiCollection as a downstream target.
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

        if direction == SOURCE:
            logger.debug(
                "Resolved Airbyte stream [%s] to API collection [%s]",
                stream.name,
                model_str(collection.fullyQualifiedName),
            )
            return EntityReference(id=collection.id, type="apiCollection")

        return self._single_endpoint_reference(source, collection, stream, pipeline_name)

    def _match_collection(
        self, source: "AirbyteSource", stream: AirbyteStream, api_services: list[str], pipeline_name: str
    ) -> APICollection | None:
        collections = [
            collection
            for collection in source.metadata.es_search_from_fqn(
                entity_type=APICollection,
                fqn_search_string=f"*.{stream.name}",
            )
            or []
            if collection.service and model_str(collection.service.name) in api_services
        ]
        if len(collections) != 1:
            logger.warning(
                "While extracting lineage: [%s], stream [%s] matched %d API collections;"
                " skipping. Set lineageInformation.apiServiceNames to disambiguate.",
                pipeline_name,
                stream.name,
                len(collections),
            )
            return None
        return collections[0]

    def _single_endpoint_reference(
        self, source: "AirbyteSource", collection: APICollection, stream: AirbyteStream, pipeline_name: str
    ) -> EntityReference | None:
        collection_fqn = model_str(collection.fullyQualifiedName)
        endpoints = [
            endpoint
            for endpoint in source.metadata.es_search_from_fqn(
                entity_type=APIEndpoint,
                fqn_search_string=f"{collection_fqn}.*",
            )
            or []
            if model_str(endpoint.fullyQualifiedName).startswith(f"{collection_fqn}.")
        ]
        if len(endpoints) != 1:
            logger.warning(
                "While extracting lineage: [%s], API destination stream [%s] maps to collection [%s]"
                " with %d endpoints; skipping (apiCollection cannot be a downstream target and safe"
                " fan-out needs exactly one endpoint).",
                pipeline_name,
                stream.name,
                collection_fqn,
                len(endpoints),
            )
            return None

        logger.debug(
            "Resolved Airbyte stream [%s] to API endpoint [%s]", stream.name, model_str(endpoints[0].fullyQualifiedName)
        )
        return EntityReference(id=endpoints[0].id, type="apiEndpoint")


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
