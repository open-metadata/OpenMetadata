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
"""MSSQL workflow invocations scoped to fixture-owned schemas."""

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
from .source import INGEST_USER_OPTION

if TYPE_CHECKING:
    from metadata.generated.schema.entity.data.table import Table
    from metadata.ingestion.ometa.ometa_api import OpenMetadata

    from ..features.database.pipelines import PipelineOptions
    from ..runtime.cli import WorkflowInvocation
    from ..server import ServerConfig
    from .source import MssqlSource


def _connection() -> dict[str, Any]:
    return {
        "type": "Mssql",
        # v1's default driver, and the only one `ingestion[test]` installs.
        "scheme": "mssql+pytds",
        "username": Env("E2E_MSSQL_USER").ref(),
        "password": Env("E2E_MSSQL_PASSWORD").ref(),
        "hostPort": Env("E2E_MSSQL_HOST_PORT").ref(),
        "database": Env("E2E_MSSQL_DATABASE").ref(),
    }


def mssql_invocation(
    *,
    service_name: str,
    sources: tuple[MssqlSource, ...],
    options: PipelineOptions,
    filters: dict[str, Any],
    server: ServerConfig,
) -> WorkflowInvocation:
    if not isinstance(sources, tuple) or not sources:
        raise ValueError("sources must be a nonempty tuple of owned MSSQL sources")
    engine = sources[0].admin_engine
    for source in sources:
        source.require_active()
        if source.admin_engine is not engine:
            raise ValueError("All MSSQL sources must belong to the same fixture instance")
    if (
        Env("E2E_MSSQL_HOST_PORT").get() != f"{engine.url.host}:{engine.url.port}"
        or Env("E2E_MSSQL_USER").get() != engine.get_execution_options()[INGEST_USER_OPTION]
        or Env("E2E_MSSQL_DATABASE").get() != engine.url.database
    ):
        raise ValueError("MSSQL environment does not identify the sources' fixture instance")
    allowed_filters = {"schemaFilterPattern", "tableFilterPattern"}
    if filters.keys() - allowed_filters:
        raise ValueError(f"Unsupported filter fields: {sorted(filters.keys() - allowed_filters)}")

    owned = {source.schema for source in sources}
    requested = filters.get("schemaFilterPattern", {})
    if requested.keys() - {"includes", "excludes"}:
        raise ValueError("Unsupported schema filter fields")
    includes = requested.get("includes", sorted(owned))
    excludes = requested.get("excludes", [])
    if not includes or not set(includes) <= owned or not set(excludes) <= owned:
        raise ValueError("Schema filters must name fixture-owned MSSQL schemas")
    scoped = {
        "includes": [f"^{re.escape(schema)}$" for schema in includes],
        "excludes": [f"^{re.escape(schema)}$" for schema in excludes],
    }
    filtered_options = type(options).model_validate({**options.model_dump(), **filters, "schemaFilterPattern": scoped})
    return database_invocation(
        source_type="mssql",
        service_name=service_name,
        service_connection=_connection(),
        server=server,
        options=filtered_options,
    )


@dataclass(frozen=True)
class MssqlContext:
    source: MssqlSource
    service_name: str
    server: ServerConfig
    om: OpenMetadata

    def invocation(
        self,
        options: PipelineOptions,
        *,
        filters: dict[str, Any] | None = None,
        sources: tuple[MssqlSource, ...] | None = None,
    ) -> WorkflowInvocation:
        return mssql_invocation(
            service_name=self.service_name,
            sources=(self.source,) if sources is None else sources,
            options=options,
            filters={} if filters is None else filters,
            server=self.server,
        )

    def table_fqn(self, name: str) -> str:
        return ".".join(
            quote_name(part) for part in (self.service_name, self.source.database, self.source.schema, name)
        )

    def column_fqn(self, table: str, column: str) -> str:
        return f"{self.table_fqn(table)}.{quote_name(column)}"

    def table_query(self, name: str) -> Query[Table | None]:
        return table_query(self.om, self.table_fqn(name))

    def profile_query(self, name: str) -> Query[Table | None]:
        return profile_query(self.om, self.table_fqn(name))

    def catalog_query(self) -> Query[CatalogSnapshot]:
        return Query(f"catalog for {self.service_name}", lambda: read_catalog(self.om, self.service_name))
