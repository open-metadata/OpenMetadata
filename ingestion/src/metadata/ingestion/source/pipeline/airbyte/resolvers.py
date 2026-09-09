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
from typing import TYPE_CHECKING

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

    def resolve(self, source, stream, connection, direction, pipeline_name) -> EntityReference | None:
        details = (
            get_source_table_details(stream, connection)
            if direction == SOURCE
            else get_destination_table_details(stream, connection)
        )
        if not details:
            return None

        table_fqn = source._get_table_fqn(details)
        if not table_fqn:
            logger.warning(
                "Airbyte lineage [%s]: table [%s].[%s].[%s] (type %s) not found in OpenMetadata",
                pipeline_name,
                details.database or "*",
                details.schema,
                details.name,
                connection.resolved_type,
            )
            return None

        entity = source.metadata.get_by_name(entity=Table, fqn=table_fqn)
        if not entity:
            logger.warning(
                "Airbyte lineage [%s]: table (fqn [%s], type %s) not found in OpenMetadata",
                pipeline_name,
                table_fqn,
                connection.resolved_type,
            )
            return None
        return EntityReference(id=entity.id, type="table")


class ContainerResolver(EntityResolver):
    """Object stores (S3) → OpenMetadata ``container``, resolved by path."""

    om_type = "container"

    def resolve(self, source, stream, connection, direction, pipeline_name) -> EntityReference | None:
        container_path = (
            get_source_container_path(stream, connection)
            if direction == SOURCE
            else get_destination_container_path(stream, connection)
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

    def resolve(self, source, stream, connection, direction, pipeline_name) -> EntityReference | None:
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

    def _service_names(self, source):
        return source.get_messaging_service_names()

    def _entity_type(self):
        return Topic

    def _build_fqn(self, source, service_name, stream):
        return fqn.build(
            metadata=source.metadata,
            entity_type=Topic,
            service_name=service_name,
            topic_name=stream.name,
        )


class SearchIndexResolver(_ServiceScopedResolver):
    """Search stores (Elasticsearch) → OpenMetadata ``searchIndex`` (index == stream name)."""

    om_type = "searchIndex"

    def _service_names(self, source):
        return source.get_search_service_names()

    def _entity_type(self):
        return SearchIndex

    def _build_fqn(self, source, service_name, stream):
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

    def resolve(self, source, stream, connection, direction, pipeline_name) -> EntityReference | None:
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

    def _match_collection(self, source, stream, api_services, pipeline_name) -> APICollection | None:
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

    def _single_endpoint_reference(self, source, collection, stream, pipeline_name) -> EntityReference | None:
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


def _build_registry() -> dict[str, EntityResolver]:
    """One connector type → one resolver. Both display-name and slug keys are present."""
    registry: dict[str, EntityResolver] = {}
    for connector_type in {*SOURCE_TYPE_LOOKUP, *DESTINATION_TYPE_LOOKUP}:
        registry[connector_type] = _TABLE_RESOLVER
    for connector_type in S3_CONNECTOR_TYPES:
        registry[connector_type] = _CONTAINER_RESOLVER
    for connector_type in MESSAGING_CONNECTOR_TYPES:
        registry[connector_type] = _TOPIC_RESOLVER
    for connector_type in SEARCH_CONNECTOR_TYPES:
        registry[connector_type] = _SEARCH_RESOLVER
    return registry


CONNECTOR_RESOLVERS: dict[str, EntityResolver] = _build_registry()


def get_resolver(resolved_type: str | None) -> EntityResolver | None:
    """
    Resolver for a connector type, or None when the type is not mapped to any entity kind.

    A None return means "unknown connector": the caller then tries the opt-in API resolver
    and, failing that, anchors on the pipeline. Unknown types are deliberately NOT routed to
    the API resolver here — that would let an unmapped relational connector (Snowflake,
    BigQuery, …) match a same-named apiCollection when apiServiceNames is set.
    """
    if not resolved_type:
        return None
    return CONNECTOR_RESOLVERS.get(resolved_type) or CONNECTOR_RESOLVERS.get(resolved_type.lower())
