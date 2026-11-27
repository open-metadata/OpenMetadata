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
"""Exasol workflow invocations scoped to fixture-owned schemas."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from metadata.generated.schema.metadataIngestion.databaseServiceQueryUsagePipeline import (
    DatabaseServiceQueryUsagePipeline,
)
from metadata.utils.fqn import quote_name

from ..features.database.catalog.snapshot import CatalogSnapshot, read_catalog
from ..features.database.config import database_invocation
from ..features.database.entities import table_query
from ..features.database.profiles import profile_query
from ..runtime.cli import WorkflowInvocation
from ..runtime.expect import Query
from ..server import Env
from .source import INGEST_USER_OPTION

if TYPE_CHECKING:
    from pathlib import Path

    from metadata.generated.schema.entity.data.table import Table
    from metadata.ingestion.ometa.ometa_api import OpenMetadata

    from ..features.database.pipelines import PipelineOptions
    from ..server import ServerConfig
    from .source import ExasolSource

# Exasol has no catalog level; OM files every schema under this one database.
EXASOL_DATABASE = "default"


def _connection() -> dict[str, Any]:
    return {
        "type": "Exasol",
        "scheme": "exa+websocket",
        "username": Env("E2E_EXASOL_USER").ref(),
        "password": Env("E2E_EXASOL_PASSWORD").ref(),
        "hostPort": Env("E2E_EXASOL_HOST_PORT").ref(),
        # The disposable container serves a self-signed certificate.
        "tls": "ignore-certificate",
    }


def _require_fixture_sources(sources: tuple[ExasolSource, ...]) -> None:
    if not isinstance(sources, tuple) or not sources:
        raise ValueError("sources must be a nonempty tuple of owned Exasol sources")
    engine = sources[0].admin_engine
    for source in sources:
        source.require_active()
        if source.admin_engine is not engine:
            raise ValueError("All Exasol sources must belong to the same fixture instance")
    if (
        Env("E2E_EXASOL_HOST_PORT").get() != f"{engine.url.host}:{engine.url.port}"
        or Env("E2E_EXASOL_USER").get() != engine.get_execution_options()[INGEST_USER_OPTION]
    ):
        raise ValueError("Exasol environment does not identify the sources' fixture instance")


def exasol_invocation(
    *,
    service_name: str,
    sources: tuple[ExasolSource, ...],
    options: PipelineOptions,
    filters: dict[str, Any],
    server: ServerConfig,
) -> WorkflowInvocation:
    _require_fixture_sources(sources)
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
        raise ValueError("Schema filters must name fixture-owned Exasol schemas")
    # EXA_SCHEMAS lists every schema in the instance to any session, so an
    # unscoped run would reach beyond the fixture.
    scoped = {
        "includes": [f"^{re.escape(schema)}$" for schema in includes],
        "excludes": [f"^{re.escape(schema)}$" for schema in excludes],
    }
    filtered_options = type(options).model_validate({**options.model_dump(), **filters, "schemaFilterPattern": scoped})
    return database_invocation(
        source_type="exasol",
        service_name=service_name,
        service_connection=_connection(),
        server=server,
        options=filtered_options,
    )


def exasol_usage_invocation(
    *,
    service_name: str,
    source: ExasolSource,
    staging_dir: Path,
    server: ServerConfig,
) -> WorkflowInvocation:
    """The query-log usage workflow, restricted to statements that name the owned schema.

    The shared database factory does not build usage workflows; Exasol is the only
    suite whose v1 test asserted usage, so the stage and bulk-sink wiring lives here.
    """
    _require_fixture_sources((source,))
    if not re.fullmatch(r"[a-z0-9_]+", source.schema):
        raise ValueError("Owned Exasol schema names are generated lower-case identifiers")
    # The audit log is instance-wide; INSTR avoids a LIKE wildcard, which the connector's
    # statement would hand to the driver's paramstyle unescaped.
    options = DatabaseServiceQueryUsagePipeline(
        queryLogDuration=1,
        resultLimit=1000,
        filterCondition=f"INSTR(LOWER(s.sql_text), '{source.schema}.') > 0",
    )
    location = str(staging_dir)
    config = {
        "source": {
            "type": "exasol-usage",
            "serviceName": service_name,
            "serviceConnection": {"config": _connection()},
            "sourceConfig": {"config": options.model_dump(mode="json", exclude_none=True)},
        },
        "processor": {"type": "query-parser", "config": {}},
        "stage": {"type": "table-usage", "config": {"filename": location}},
        "bulkSink": {"type": "metadata-usage", "config": {"filename": location}},
        "workflowConfig": server.to_workflow_config_dict(),
    }
    return WorkflowInvocation("usage", config)


@dataclass(frozen=True)
class ExasolContext:
    source: ExasolSource
    service_name: str
    server: ServerConfig
    om: OpenMetadata

    def invocation(
        self,
        options: PipelineOptions,
        *,
        filters: dict[str, Any] | None = None,
        sources: tuple[ExasolSource, ...] | None = None,
    ) -> WorkflowInvocation:
        return exasol_invocation(
            service_name=self.service_name,
            sources=(self.source,) if sources is None else sources,
            options=options,
            filters={} if filters is None else filters,
            server=self.server,
        )

    def usage_invocation(self, staging_dir: Path) -> WorkflowInvocation:
        return exasol_usage_invocation(
            service_name=self.service_name, source=self.source, staging_dir=staging_dir, server=self.server
        )

    def table_fqn(self, name: str) -> str:
        return ".".join(quote_name(part) for part in (self.service_name, EXASOL_DATABASE, self.source.schema, name))

    def column_fqn(self, table: str, column: str) -> str:
        return f"{self.table_fqn(table)}.{quote_name(column)}"

    def table_query(self, name: str) -> Query[Table | None]:
        return table_query(self.om, self.table_fqn(name))

    def profile_query(self, name: str) -> Query[Table | None]:
        return profile_query(self.om, self.table_fqn(name))

    def catalog_query(self) -> Query[CatalogSnapshot]:
        return Query(f"catalog for {self.service_name}", lambda: read_catalog(self.om, self.service_name))
