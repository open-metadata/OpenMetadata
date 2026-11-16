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
"""Oracle workflow configuration bound to explicit owned source resources."""

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
from .source import INGEST_USER_OPTION

if TYPE_CHECKING:
    from metadata.generated.schema.entity.data.table import Table
    from metadata.ingestion.ometa.ometa_api import OpenMetadata

    from ..features.database.pipelines import PipelineOptions
    from ..runtime.cli import WorkflowInvocation
    from ..server import ServerConfig
    from .source import OracleSource


def _connection() -> dict[str, Any]:
    """Build the Oracle service connection.

    ``preserveIdentifierCase`` is deliberately left at its default so the connector
    normalises Oracle's uppercase dictionary names back to the lowercase identifiers
    the baseline declares. The database name is the Oracle service name, which is
    why every FQN's database segment is ``FREEPDB1`` rather than ``default``.
    """
    return {
        "type": "Oracle",
        "username": Env("E2E_ORACLE_USER").ref(),
        "password": Env("E2E_ORACLE_PASSWORD").ref(),
        "hostPort": Env("E2E_ORACLE_HOST_PORT").ref(),
        "oracleConnectionType": {"oracleServiceName": Env("E2E_ORACLE_SERVICE_NAME").ref()},
    }


def oracle_invocation(
    *,
    service_name: str,
    sources: tuple[OracleSource, ...],
    options: PipelineOptions,
    filters: dict[str, Any],
    server: ServerConfig,
) -> WorkflowInvocation:
    """Discover the explicitly supplied schemas on one owned instance."""
    if not isinstance(sources, tuple) or not sources:
        raise ValueError("sources must be a nonempty tuple of owned Oracle sources")
    engine = sources[0].admin_engine
    schemas = []
    for source in sources:
        source.require_active()
        if source.admin_engine is not engine:
            raise ValueError("All Oracle sources must belong to the same fixture instance")
        schemas.append(source.schema)
    if (
        Env("E2E_ORACLE_HOST_PORT").get() != f"{engine.url.host}:{engine.url.port}"
        or Env("E2E_ORACLE_USER").get() != engine.get_execution_options()[INGEST_USER_OPTION]
    ):
        raise ValueError("Oracle environment does not identify the sources' fixture instance")
    allowed = {"databaseFilterPattern", "schemaFilterPattern", "tableFilterPattern"}
    if filters.keys() - allowed:
        raise ValueError(f"Unsupported filter fields: {sorted(filters.keys() - allowed)}")
    # Oracle reads the DBA_ dictionary views, so an unscoped run would discover every
    # schema in the instance, including Oracle's own. Unlike MySQL there is no
    # connection-level scope to lean on: oracleConnectionType accepts a service name or
    # a databaseSchema, never both. Scope to the owned schemas unless a case overrides it.
    scoped = {"schemaFilterPattern": {"includes": [f"^{schema}$" for schema in schemas]}, **filters}
    filtered_options = type(options).model_validate({**options.model_dump(), **scoped})
    return database_invocation(
        source_type="oracle",
        service_name=service_name,
        service_connection=_connection(),
        server=server,
        options=filtered_options,
    )


@dataclass(frozen=True)
class OracleContext:
    source: OracleSource
    service_name: str
    server: ServerConfig
    om: OpenMetadata

    def invocation(
        self,
        options: PipelineOptions,
        *,
        filters: dict[str, Any] | None = None,
        sources: tuple[OracleSource, ...] | None = None,
    ) -> WorkflowInvocation:
        return oracle_invocation(
            service_name=self.service_name,
            sources=(self.source,) if sources is None else sources,
            options=options,
            filters={} if filters is None else filters,
            server=self.server,
        )

    def table_fqn(self, name: str) -> str:
        """Build an FQN from the name OM actually stores.

        Tables, views and columns are all lowercase. The database segment is
        ``default`` — the connector does not put the Oracle service name here.
        """
        parts = (self.service_name, "default", self.source.schema, name)
        return ".".join(quote_name(part) for part in parts)

    def column_fqn(self, table: str, column: str) -> str:
        return f"{self.table_fqn(table)}.{quote_name(column)}"

    def table_query(self, name: str) -> Query[Table | None]:
        return table_query(self.om, self.table_fqn(name))

    def profile_query(self, name: str) -> Query[Table | None]:
        return profile_query(self.om, self.table_fqn(name))

    def catalog_query(self) -> Query[CatalogSnapshot]:
        return Query(f"catalog for {self.service_name}", lambda: read_catalog(self.om, self.service_name))
