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

from metadata.entity_resolution.engine import (
    EntityResolutionPlan,
    EntityResolver,
    FqnCandidate,
    FqnLookupMode,
    ResolutionTier,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.utils import fqn


class TableResolver:
    """Build table plans without owning cache state or the client lifecycle."""

    def __init__(self, resolver: EntityResolver):
        self._resolver = resolver

    def resolve(
        self,
        *,
        service_names: tuple[str, ...],
        database_name: str | None,
        database_schema: str | None,
        table_name: str,
        schema_fallback: bool = False,
        fields: tuple[str, ...] = (),
        include: str | None = None,
        ignore_database: bool = False,
    ) -> tuple[Table, ...]:
        if "*" in service_names and service_names != ("*",):
            raise ValueError("Wildcard service selection cannot be mixed with named services")
        tiers = []
        if table_name:
            parts = fqn.split_raw_name(table_name)
            if len(parts) > 3:
                parts = [parts[-1]]
            database, schema, table = [None] * (3 - len(parts)) + parts
            database = (None if database == "<default>" else database) or database_name
            schema = (None if schema == "<default>" else schema) or database_schema
            if ignore_database:
                database = None
            schemas = (schema, None) if schema_fallback and schema else (schema,)
            for schema in schemas:
                for service in service_names:
                    components = (service, database, schema, table)
                    if service != "*" and all(components):
                        value = ".".join(fqn.quote_name(part) for part in components if part is not None)
                        tiers.append(ResolutionTier((FqnCandidate(value, FqnLookupMode.EXACT),)))
                        if include not in ("all", "deleted"):
                            tiers.append(ResolutionTier((FqnCandidate(value, FqnLookupMode.CASE_INSENSITIVE_EXACT),)))
                    else:
                        value = ".".join(
                            "*"
                            if part is None or (index == 0 and part == "*")
                            else fqn.quote_name(part).replace("\\", "\\\\").replace("*", "\\*").replace("?", "\\?")
                            for index, part in enumerate(components)
                        )
                        tiers.append(ResolutionTier((FqnCandidate(value, FqnLookupMode.WILDCARD),)))
        return self._resolver.resolve(
            EntityResolutionPlan(entity_type=Table, tiers=tuple(tiers), fields=fields, include=include)
        )
