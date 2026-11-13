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
"""Default table resolution and caller lookup policies."""

import importlib
import traceback
from enum import Enum
from importlib.machinery import PathFinder
from typing import Any, cast

from metadata.domain.table_reference import TableReference
from metadata.entity_resolution.engine import EntityResolutionPlan, EntityResolver
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.type.queryParserData import ParsedData
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.fqn import build_es_fqn_search_string
from metadata.utils.importer import get_module_dir
from metadata.utils.logger import utils_logger
from metadata.utils.lru_cache import LRU_CACHE_SIZE, LRUCache

logger = utils_logger()
alias_resolution_cache = LRUCache(LRU_CACHE_SIZE)

# Connectors opt into alias lookup through their connection configuration.
ALIAS_OPT_IN_FIELD = "includeSynonyms"


class UnsupportedTableReferenceError(ValueError):
    """The connector cannot resolve this reference without additional source evidence."""


def load_table_binding_resolution(
    source_type: str | None,
    metadata: OpenMetadata,
    *,
    engine: EntityResolver | None = None,
) -> "TableBindingResolution":
    """Load an optional connector resolver; only an absent module uses the default."""
    if not source_type:
        return TableBindingResolution(metadata, engine)
    database = importlib.import_module("metadata.ingestion.source.database")
    package_name = f"{database.__name__}.{get_module_dir(source_type.lower())}"
    package_spec = PathFinder.find_spec(package_name, database.__path__)
    if package_spec is None or package_spec.submodule_search_locations is None:
        return TableBindingResolution(metadata, engine)
    module_name = f"{package_name}.resolution"
    # Probe the child path without executing the connector package initializer.
    if PathFinder.find_spec(module_name, package_spec.submodule_search_locations) is None:
        return TableBindingResolution(metadata, engine)
    module = importlib.import_module(module_name)
    resolution_class = module.TableBindingResolution
    if not isinstance(resolution_class, type) or not issubclass(resolution_class, TableBindingResolution):
        raise TypeError(f"{module_name}.TableBindingResolution must subclass the shared TableBindingResolution")
    return resolution_class(metadata, engine)


def service_resolves_aliases(metadata: OpenMetadata, service_name: str | None) -> bool:
    """Whether a named service opts into alternate table names."""
    if not service_name or service_name == "*":
        return False
    key = service_name
    if key in alias_resolution_cache:
        return bool(alias_resolution_cache.get(key))

    resolves = False
    try:
        service: DatabaseService | None = metadata.get_by_name(entity=DatabaseService, fqn=service_name)
        if service:
            resolves = bool(getattr(service.connection.config, ALIAS_OPT_IN_FIELD, False))
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning("Could not read alias opt-in for service '%s', assuming disabled: %s", service_name, exc)

    alias_resolution_cache.put(key, resolves)

    return resolves


class TableLookup(Enum):
    """Existing catalog lookup order and result selection required by callers."""

    CATALOG = "catalog"
    LINEAGE = "lineage"
    SEARCH = "search"
    FIRST_MATCH = "first_match"
    FQN = "fqn"


class TableBindingResolution:
    """Resolve references using the standard catalog namespace."""

    def __init__(self, metadata: OpenMetadata, engine: EntityResolver | None = None):
        self.metadata = metadata
        self.engine = engine

    def _normalize_reference(self, reference: TableReference, service_name: str | None) -> TableReference:
        return reference

    def resolve(
        self,
        reference: TableReference,
        *,
        service_name: str | None = None,
        fields: tuple[str, ...] = (),
        include: str | None = None,
        lookup: TableLookup = TableLookup.CATALOG,
    ) -> tuple[Table, ...]:
        reference = self._normalize_reference(reference, service_name)
        if lookup == TableLookup.LINEAGE:
            return self._resolve_lineage(reference, service_name)
        if lookup == TableLookup.FQN:
            name = fqn.build(
                self.metadata,
                entity_type=Table,
                service_name=service_name,
                database_name=reference.database,
                schema_name=reference.schema,
                table_name=reference.table,
            )
            table = self.metadata.get_by_name(entity=Table, fqn=name) if name else None
            return (table,) if table else ()
        if lookup == TableLookup.FIRST_MATCH:
            search = build_es_fqn_search_string(reference.database, reference.schema, service_name, reference.table)
            if not fields:
                table = cast(
                    "Table | None", self.metadata.search_in_any_service(entity_type=Table, fqn_search_string=search)
                )
                return (table,) if table else ()
            matches = self.metadata.es_search_from_fqn(
                entity_type=Table, fqn_search_string=search, fields=",".join(fields)
            )
            return tuple(table for table in matches or () if table is not None)[:1]
        if lookup == TableLookup.SEARCH:
            if "*" in reference.table:
                return ()
            search = build_es_fqn_search_string(reference.database, reference.schema, service_name, reference.table)
            options: dict[str, Any] = {"fields": ",".join(fields)} if fields else {}
            return tuple(
                table
                for table in self.metadata.es_search_from_fqn(
                    entity_type=Table,
                    fqn_search_string=fqn.prefix_entity_for_wildcard_search(Table, search),
                    raise_on_error=True,
                    **options,
                )
                or ()
                if table is not None
            )
        from metadata.entity_resolution.table import table_lookup_tiers

        engine = self.engine or EntityResolver(self.metadata)
        try:
            return engine.resolve(
                EntityResolutionPlan(
                    Table, table_lookup_tiers(service_name or "*", reference, include), fields, include
                )
            )
        finally:
            if self.engine is None:
                engine.close()

    def prepare_usage(self, execution: ParsedData) -> ParsedData:
        """Preserve ordinary usage references without catalog lookups."""
        return execution

    def _resolve_lineage(self, reference: TableReference, service_name: str | None) -> tuple[Table, ...]:
        metadata = self.metadata
        normalized_db, normalized_schema, table = reference.database, reference.schema, reference.table
        try:
            table_entities: list[Table] | None = []

            # search on ES first
            fqn_search_string = build_es_fqn_search_string(normalized_db, normalized_schema, service_name, table)
            es_result_entities = metadata.es_search_from_fqn(
                entity_type=Table,
                fqn_search_string=fqn_search_string,
            )
            if es_result_entities:
                table_entities = es_result_entities
            else:
                # build FQNs and search with the API in case ES response is empty
                table_fqns = fqn.build(
                    metadata,
                    entity_type=Table,
                    service_name=service_name,
                    database_name=normalized_db,
                    schema_name=normalized_schema,
                    table_name=table,
                    fetch_multiple_entities=True,
                    skip_es_search=True,
                )
                for table_fqn in table_fqns or []:
                    table_entity: Table | None = metadata.get_by_name(Table, fqn=table_fqn)
                    if table_entity:
                        table_entities.append(table_entity)

            if table_entities:
                return tuple(table_entities)

            # An alias name resolves to the canonical table it points at.
            # Gated per service so connectors that cannot produce aliases never
            # pay for the extra lookup.
            if not service_resolves_aliases(metadata, service_name):
                return ()

            alias_fqn = fqn.build(
                metadata,
                entity_type=Table,
                service_name=service_name,
                database_name=normalized_db,
                schema_name=normalized_schema,
                table_name=table,
                skip_es_search=True,
            )
            if alias_fqn:
                alias_entities = metadata.es_search_from_alias(
                    entity_type=Table,
                    alias_fqn=alias_fqn,
                )
                if alias_entities:
                    return tuple(alias_entities)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error("Error searching for table entities for service [%s]: %s", service_name, exc)

        return ()
