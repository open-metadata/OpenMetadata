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

"""Table identity and fallback policy for entity resolution."""

from dataclasses import replace

from cachetools import LRUCache

from metadata.domain.table_reference import TableReference
from metadata.entity_resolution.engine import (
    EntityResolver,
    FqnCandidate,
    FqnLookupMode,
    ResolutionTier,
)
from metadata.entity_resolution.table_binding import TableLookup
from metadata.generated.schema.entity.data.table import Table
from metadata.utils import fqn


def _parse_reference(table_name: str, database: str | None, schema: str | None) -> TableReference:
    parts = fqn.split_raw_name(table_name)
    if len(parts) > 3:
        parts = [parts[-1]]
    parsed_database, parsed_schema, _ = [None] * (3 - len(parts)) + parts
    return TableReference(
        (None if parsed_database == "<default>" else parsed_database) or database,
        (None if parsed_schema == "<default>" else parsed_schema) or schema,
        parts[-1],
    )


def table_lookup_tiers(service: str, reference: TableReference, include: str | None) -> tuple[ResolutionTier, ...]:
    """Prefer exact names; use wildcard discovery only for missing components."""
    components = (service, reference.database, reference.schema, reference.table)
    if service != "*" and all(components):
        value = ".".join(fqn.quote_name(part) for part in components if part is not None)
        modes = (FqnLookupMode.EXACT,)
        if include not in ("all", "deleted"):
            modes += (FqnLookupMode.CASE_INSENSITIVE_EXACT,)
        return tuple(ResolutionTier((FqnCandidate(value, mode),)) for mode in modes)
    value = ".".join(
        "*"
        if part is None or (index == 0 and part == "*")
        else fqn.quote_name(part).replace("\\", "\\\\").replace("*", "\\*").replace("?", "\\?")
        for index, part in enumerate(components)
    )
    return (ResolutionTier((FqnCandidate(value, FqnLookupMode.WILDCARD),)),)


class TableResolver:
    """Resolve table references within one execution without owning the client."""

    def __init__(self, resolver: EntityResolver, service_types: dict[str, str] | None = None):
        self._resolver = resolver
        self._service_types = service_types or {}
        self._lineage_cache: LRUCache[tuple, tuple[Table, ...]] = LRUCache(maxsize=512)

    def resolve(
        self,
        *,
        service_names: tuple[str, ...] | None = None,
        database_name: str | None,
        database_schema: str | None,
        table_name: str,
        schema_fallback: bool = False,
        fields: tuple[str, ...] = (),
        include: str | None = None,
        lookup: TableLookup = TableLookup.CATALOG,
    ) -> tuple[Table, ...]:
        from metadata.entity_resolution.table_binding import load_table_binding_resolution  # noqa: PLC0415

        names = service_names or tuple(self._service_types) or ("*",)
        if "*" in names and names != ("*",):
            raise ValueError("Wildcard service selection cannot be mixed with named services")
        if not table_name:
            return ()
        reference = _parse_reference(table_name, database_name, database_schema)
        schemas = (reference.schema, None) if schema_fallback and reference.schema else (reference.schema,)
        for schema in schemas:
            for name in names:
                key = (name, replace(reference, schema=schema), fields, include)
                if lookup == TableLookup.LINEAGE and key in self._lineage_cache:
                    return self._lineage_cache[key]
                resolution = load_table_binding_resolution(
                    self._service_types.get(name), self._resolver.metadata, engine=self._resolver
                )
                matches = resolution.resolve(
                    replace(reference, schema=schema), service_name=name, fields=fields, include=include, lookup=lookup
                )
                if matches:
                    if lookup == TableLookup.LINEAGE:
                        self._lineage_cache[key] = matches
                    return matches
        return ()
