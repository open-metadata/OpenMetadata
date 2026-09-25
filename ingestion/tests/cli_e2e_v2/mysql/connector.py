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
"""MySQL workflow configuration bound to explicit owned source resources."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from metadata.utils.fqn import quote_name

from ..features.database.catalog.snapshot import CatalogSnapshot, read_catalog
from ..features.database.config import database_invocation
from ..features.database.entities import table_query
from ..features.database.profiles import profile_query
from ..runtime.expect import Query
from ..server import Env

if TYPE_CHECKING:
    from metadata.generated.schema.entity.data.table import Table
    from metadata.ingestion.ometa.ometa_api import OpenMetadata

    from ..features.database.pipelines import PipelineOptions
    from ..runtime.cli import WorkflowInvocation
    from ..server import ServerConfig
    from .source import MySqlSource


def _connection(*, schema: str | None) -> dict[str, Any]:
    connection: dict[str, Any] = {
        "type": "Mysql",
        "username": Env("E2E_MYSQL_USER").ref(),
        "authType": {"password": Env("E2E_MYSQL_PASSWORD").ref()},
        "hostPort": Env("E2E_MYSQL_HOST_PORT").ref(),
    }
    if schema is not None:
        connection["databaseSchema"] = schema
    return connection


def mysql_invocation(
    *,
    service_name: str,
    sources: tuple[MySqlSource, ...],
    options: PipelineOptions,
    filters: dict[str, Any],
    server: ServerConfig,
) -> WorkflowInvocation:
    """Bind one schema literally, or discover all explicitly supplied schemas on one instance."""
    if not isinstance(sources, tuple) or not sources:
        raise ValueError("sources must be a nonempty tuple of owned MySQL sources")
    engine = sources[0].admin_engine
    for source in sources:
        source.require_active()
        if source.admin_engine is not engine:
            raise ValueError("All MySQL sources must belong to the same fixture instance")
    if (
        Env("E2E_MYSQL_HOST_PORT").get() != f"{engine.url.host}:{engine.url.port}"
        or Env("E2E_MYSQL_USER").get() != engine.get_execution_options()["e2e_mysql_ingest_user"]
    ):
        raise ValueError("MySQL environment does not identify the sources' fixture instance")
    allowed = {"databaseFilterPattern", "schemaFilterPattern", "tableFilterPattern"}
    if filters.keys() - allowed:
        raise ValueError(f"Unsupported filter fields: {sorted(filters.keys() - allowed)}")
    filtered_options = type(options).model_validate({**options.model_dump(), **filters})
    return database_invocation(
        source_type="mysql",
        service_name=service_name,
        service_connection=_connection(schema=sources[0].schema if len(sources) == 1 else None),
        server=server,
        options=filtered_options,
    )


@dataclass(frozen=True)
class MySqlContext:
    source: MySqlSource
    service_name: str
    server: ServerConfig
    om: OpenMetadata

    def invocation(
        self,
        options: PipelineOptions,
        *,
        filters: dict[str, Any] | None = None,
        sources: tuple[MySqlSource, ...] | None = None,
    ) -> WorkflowInvocation:
        return mysql_invocation(
            service_name=self.service_name,
            sources=(self.source,) if sources is None else sources,
            options=options,
            filters={} if filters is None else filters,
            server=self.server,
        )

    def table_fqn(self, name: str) -> str:
        return ".".join(quote_name(part) for part in (self.service_name, "default", self.source.schema, name))

    def column_fqn(self, table: str, column: str) -> str:
        return f"{self.table_fqn(table)}.{quote_name(column)}"

    def table_query(self, name: str) -> Query[Table | None]:
        return table_query(self.om, self.table_fqn(name))

    def profile_query(self, name: str) -> Query[Table | None]:
        return profile_query(self.om, self.table_fqn(name))

    def catalog_query(self) -> Query[CatalogSnapshot]:
        return Query(f"catalog for {self.service_name}", lambda: read_catalog(self.om, self.service_name))
