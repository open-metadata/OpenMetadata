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
"""Service selection and cached catalog lookups shared by table consumers."""

import traceback
from typing import Any

from metadata.domain.table_reference import TableReference
from metadata.entity_resolution.table_binding import TableBindingResolution, TableLookup, load_table_binding_resolution
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.logger import utils_logger
from metadata.utils.lru_cache import LRU_CACHE_SIZE, LRUCache

logger = utils_logger()
DEFAULT_SCHEMA_NAME = "<default>"

search_cache = LRUCache(LRU_CACHE_SIZE)
database_service_type_cache = LRUCache(LRU_CACHE_SIZE)


def get_database_service_type(metadata: OpenMetadata, service_name: str) -> str | None:
    """Resolve and cache a service type, searching the index before the catalog API."""
    key = service_name
    if key in database_service_type_cache:
        return database_service_type_cache.get(key)

    try:
        es_result_entities = metadata.es_search_from_fqn(
            entity_type=DatabaseService,
            fqn_search_string=service_name,
        )

        service: DatabaseService | None = None
        if es_result_entities:
            service = es_result_entities[0] if es_result_entities else None

        if not service:
            service = metadata.get_by_name(entity=DatabaseService, fqn=service_name)

        if service:
            service_type = service.serviceType.value.lower()
            logger.debug("Service %s is of type %s", service_name, service_type)

            database_service_type_cache.put(key, service_type)
            return service_type

    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning("Could not determine service type for service %s: %s", service_name, exc)

    return None


def get_table_binding_resolution(metadata: OpenMetadata, service_name: str | None) -> TableBindingResolution:
    """Load resolution for a known service, or the default for an unscoped reference."""
    service_type = get_database_service_type(metadata, service_name) if service_name and service_name != "*" else None
    return load_table_binding_resolution(service_type, metadata)


def search_table_entities(
    metadata: OpenMetadata,
    service_names: str | list[str] | None,
    database: str | None,
    database_schema: str | None,
    table: str,
) -> list[Table] | None:
    """Return matches from the first matching service, or search across services when unscoped."""
    if not table:
        logger.debug(
            "Skipping table entity search with an empty table name for database [%s] and schema [%s]",
            database,
            database_schema,
        )
        return None

    if isinstance(service_names, str):
        service_names = [service_names]

    for service_name in service_names or [None]:
        try:
            result = _search_service_tables(metadata, service_name, database, database_schema, table)
        except Exception:
            logger.debug(
                "Unable to resolve table [%s.%s.%s] in service [%s]",
                database,
                database_schema,
                table,
                service_name,
                exc_info=True,
            )
            continue
        if result:
            return result
    return None


def _search_service_tables(metadata, service_name, database, database_schema, table):
    key = (service_name, database, database_schema, table)
    if key in search_cache:
        return search_cache.get(key)
    resolution = get_table_binding_resolution(metadata, service_name)
    matches = resolution.resolve(
        TableReference(database, database_schema, table),
        service_name=service_name,
        lookup=TableLookup.LINEAGE,
    )
    result = list(matches) if matches else None
    if result:
        search_cache.put(key, result)
    return result


def get_table_fqn_from_query_name(
    table_name: str,
) -> tuple[str | None, str | None, str | None]:
    """Split a quoted reference; names with more than three components retain only the table."""
    split_table = fqn.split_raw_name(table_name)
    empty_list: list[Any] = [None]  # Otherwise, there's a typing error in the concat

    if len(split_table) > 3:
        table = split_table[-1]
        database_query, schema_query = None, None
    else:
        database_query, schema_query, table = (empty_list * (3 - len(split_table))) + split_table

        logger.debug(
            "Extracted reference components: database=%s, schema=%s, table=%s",
            database_query,
            schema_query,
            table,
        )

    if schema_query == DEFAULT_SCHEMA_NAME:
        schema_query = None

    if database_query == DEFAULT_SCHEMA_NAME:
        database_query = None

    return database_query, schema_query, table
