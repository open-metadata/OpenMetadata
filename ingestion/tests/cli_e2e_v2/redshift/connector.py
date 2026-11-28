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
"""Redshift workflow configuration bound to explicit owned schemas."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from metadata.utils.fqn import quote_name

from ..features.database.catalog.snapshot import CatalogSnapshot, read_catalog
from ..features.database.config import database_invocation
from ..features.database.entities import table_query
from ..features.database.profiles import profile_query
from ..runtime.expect import Query
from ..server import Env
from .source import DATABASE_ENV, HOST_PORT_ENV, PASSWORD_ENV, USERNAME_ENV

if TYPE_CHECKING:
    from metadata.generated.schema.entity.data.table import Table
    from metadata.ingestion.ometa.ometa_api import OpenMetadata

    from ..features.database.pipelines import PipelineOptions
    from ..runtime.cli import WorkflowInvocation
    from ..server import ServerConfig
    from .source import RedshiftInstance, RedshiftSource

_FILTERS = {"schemaFilterPattern", "tableFilterPattern"}


def owned_schema_pattern(sources: tuple[RedshiftSource, ...]) -> dict[str, list[str]]:
    return {"includes": [f"^{re.escape(source.schema)}$" for source in sources]}


def _connection() -> dict[str, Any]:
    return {
        "type": "Redshift",
        "hostPort": Env(HOST_PORT_ENV).ref(),
        "username": Env(USERNAME_ENV).ref(),
        "authType": {"password": Env(PASSWORD_ENV).ref()},
        "database": Env(DATABASE_ENV).ref(),
        "sslMode": "require",
    }


def _require_owned(sources: tuple[RedshiftSource, ...], instance: RedshiftInstance) -> None:
    if not isinstance(sources, tuple) or not sources:
        raise ValueError("sources must be a nonempty tuple of owned Redshift sources")
    for source in sources:
        source.require_active()
        if source.instance is not instance:
            raise ValueError("All Redshift sources must belong to the session's E2E cluster")
    if len({source.schema for source in sources}) != len(sources):
        raise ValueError("Redshift sources must be distinct schemas")


def redshift_invocation(
    *,
    service_name: str,
    sources: tuple[RedshiftSource, ...],
    instance: RedshiftInstance,
    options: PipelineOptions,
    filters: dict[str, Any],
    server: ServerConfig,
) -> WorkflowInvocation:
    """Scope every workflow to explicitly owned schemas: the shared cluster also holds unowned ones."""
    _require_owned(sources, instance)
    if filters.keys() - _FILTERS:
        raise ValueError(f"Unsupported filter fields: {sorted(filters.keys() - _FILTERS)}")
    owned = owned_schema_pattern(sources)
    schema_pattern = filters.get("schemaFilterPattern", owned)
    includes = schema_pattern.get("includes")
    excludes = schema_pattern.get("excludes", [])
    if not includes or set(includes) - set(owned["includes"]) or set(excludes) - set(owned["includes"]):
        raise ValueError("schemaFilterPattern may name only the owned schemas, as their anchored patterns")
    if schema_pattern.keys() - {"includes", "excludes"}:
        raise ValueError("Unsupported schema filter fields")
    return database_invocation(
        source_type="redshift",
        service_name=service_name,
        service_connection=_connection(),
        server=server,
        options=type(options).model_validate(
            {**options.model_dump(), **filters, "schemaFilterPattern": schema_pattern}
        ),
    )


@dataclass(frozen=True)
class RedshiftContext:
    """Owned source plus service identity. Entity names are Redshift's stored, lower-case identifiers."""

    source: RedshiftSource
    instance: RedshiftInstance
    service_name: str
    server: ServerConfig
    om: OpenMetadata

    def invocation(
        self,
        options: PipelineOptions,
        *,
        filters: dict[str, Any] | None = None,
        sources: tuple[RedshiftSource, ...] | None = None,
    ) -> WorkflowInvocation:
        return redshift_invocation(
            service_name=self.service_name,
            sources=(self.source,) if sources is None else sources,
            instance=self.instance,
            options=options,
            filters={} if filters is None else filters,
            server=self.server,
        )

    def schema_fqn(self, source: RedshiftSource | None = None) -> str:
        schema = (source or self.source).schema
        return ".".join(quote_name(part) for part in (self.service_name, self.instance.database, schema))

    def table_fqn(self, name: str, source: RedshiftSource | None = None) -> str:
        return f"{self.schema_fqn(source)}.{quote_name(name)}"

    def column_fqn(self, table: str, column: str) -> str:
        return f"{self.table_fqn(table)}.{quote_name(column)}"

    def table_query(self, name: str) -> Query[Table | None]:
        return table_query(self.om, self.table_fqn(name))

    def profile_query(self, name: str) -> Query[Table | None]:
        return profile_query(self.om, self.table_fqn(name))

    def catalog_query(self) -> Query[CatalogSnapshot]:
        return Query(f"catalog for {self.service_name}", lambda: read_catalog(self.om, self.service_name))
