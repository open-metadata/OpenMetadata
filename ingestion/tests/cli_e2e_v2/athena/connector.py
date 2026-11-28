#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Athena workflow configuration bound to explicitly owned Glue databases."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table
from metadata.utils.fqn import quote_name

from ..features.database.catalog.snapshot import CatalogSnapshot, read_catalog
from ..features.database.config import database_invocation
from ..features.database.entities import table_query
from ..features.database.profiles import profile_query
from ..runtime.expect import Query
from ..server import Env
from .source import REGION_ENV, STAGING_DIR_ENV, WORKGROUP_ENV

if TYPE_CHECKING:
    from metadata.ingestion.ometa.ometa_api import OpenMetadata

    from ..features.database.pipelines import PipelineOptions
    from ..runtime.cli import WorkflowInvocation
    from ..server import ServerConfig
    from .source import AthenaInstance, AthenaSource

# The connection's `databaseName`: Athena has one catalog per connection, named in OM by this setting.
OM_DATABASE = "e2e_catalog"
_FILTERS = {"schemaFilterPattern", "tableFilterPattern"}


def _connection() -> dict[str, Any]:
    return {
        "type": "Athena",
        "awsConfig": {"awsRegion": Env(REGION_ENV).ref()},
        "s3StagingDir": Env(STAGING_DIR_ENV).ref(),
        "workgroup": Env(WORKGROUP_ENV).ref(),
        "databaseName": OM_DATABASE,
    }


def _owned_schema_filter(sources: tuple[AthenaSource, ...], requested: dict[str, Any]) -> dict[str, list[str]]:
    """Anchor the schema filter to owned databases; the Glue catalog also holds unowned ones."""
    owned = {source.database for source in sources}
    if requested.keys() - {"includes", "excludes"}:
        raise ValueError("Unsupported schema filter fields")
    includes = requested.get("includes", sorted(owned))
    excludes = requested.get("excludes", [])
    if not includes or not set(includes) <= owned or not set(excludes) <= owned:
        raise ValueError("Schema filters must name fixture-owned Glue databases")
    return {
        "includes": [f"^{re.escape(name)}$" for name in includes],
        "excludes": [f"^{re.escape(name)}$" for name in excludes],
    }


def athena_invocation(
    *,
    service_name: str,
    sources: tuple[AthenaSource, ...],
    instance: AthenaInstance,
    options: PipelineOptions,
    filters: dict[str, Any],
    server: ServerConfig,
) -> WorkflowInvocation:
    if not isinstance(sources, tuple) or not sources:
        raise ValueError("sources must be a nonempty tuple of owned Athena sources")
    for source in sources:
        source.require_active()
        if source.instance is not instance:
            raise ValueError("All Athena sources must belong to the session's E2E account")
    if len({source.database for source in sources}) != len(sources):
        raise ValueError("Athena sources must be distinct databases")
    if filters.keys() - _FILTERS:
        raise ValueError(f"Unsupported filter fields: {sorted(filters.keys() - _FILTERS)}")
    if "schemaFilterPattern" not in type(options).model_fields:
        raise ValueError(f"{type(options).__name__} cannot be scoped to owned Glue databases")
    scoped = {**filters, "schemaFilterPattern": _owned_schema_filter(sources, filters.get("schemaFilterPattern", {}))}
    return database_invocation(
        source_type="athena",
        service_name=service_name,
        service_connection=_connection(),
        server=server,
        options=type(options).model_validate({**options.model_dump(), **scoped}),
    )


@dataclass(frozen=True)
class AthenaContext:
    source: AthenaSource
    instance: AthenaInstance
    service_name: str
    server: ServerConfig
    om: OpenMetadata

    def invocation(
        self,
        options: PipelineOptions,
        *,
        filters: dict[str, Any] | None = None,
        sources: tuple[AthenaSource, ...] | None = None,
    ) -> WorkflowInvocation:
        return athena_invocation(
            service_name=self.service_name,
            sources=(self.source,) if sources is None else sources,
            instance=self.instance,
            options=options,
            filters={} if filters is None else filters,
            server=self.server,
        )

    def schema_fqn(self) -> str:
        return ".".join(quote_name(part) for part in (self.service_name, OM_DATABASE, self.source.database))

    def table_fqn(self, name: str) -> str:
        return f"{self.schema_fqn()}.{quote_name(name)}"

    def column_fqn(self, table: str, column: str) -> str:
        return f"{self.table_fqn(table)}.{quote_name(column)}"

    def schema_query(self) -> Query[DatabaseSchema | None]:
        fqn = self.schema_fqn()
        return Query(f"schema {fqn}", lambda: self.om.get_by_name(DatabaseSchema, fqn))

    def table_query(self, name: str) -> Query[Table | None]:
        return table_query(self.om, self.table_fqn(name))

    def partition_query(self, name: str) -> Query[Table | None]:
        fqn = self.table_fqn(name)
        return Query(
            f"partitioned table {fqn}",
            lambda: self.om.get_by_name(entity=Table, fqn=fqn, fields=["columns", "tablePartition"], include="all"),
        )

    def profile_query(self, name: str) -> Query[Table | None]:
        return profile_query(self.om, self.table_fqn(name))

    def catalog_query(self) -> Query[CatalogSnapshot]:
        return Query(f"catalog for {self.service_name}", lambda: read_catalog(self.om, self.service_name))
