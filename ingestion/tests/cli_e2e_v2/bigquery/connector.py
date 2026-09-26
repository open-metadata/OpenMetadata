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
"""BigQuery workflow configuration bound to explicit owned datasets."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from metadata.utils.fqn import quote_name

from ..features.database.catalog.snapshot import CatalogSnapshot, read_catalog
from ..features.database.config import database_invocation
from ..features.database.entities import table_query
from ..features.database.pipelines import TestPipeline
from ..features.database.profiles import profile_query
from ..runtime.expect import Query
from ..server import Env
from .source import ADC_AUTH, CLI_PRIVATE_KEY_ENV, PRIMARY_PROJECT_ENV, SECONDARY_PROJECT_ENV

if TYPE_CHECKING:
    from metadata.data_quality.api.models import TestCaseDefinition
    from metadata.generated.schema.entity.data.table import Table
    from metadata.ingestion.ometa.ometa_api import OpenMetadata

    from ..features.database.pipelines import PipelineOptions
    from ..runtime.cli import WorkflowInvocation
    from ..server import ServerConfig
    from .source import BigQueryInstance, BigQuerySource

_FILTERS = {"databaseFilterPattern", "schemaFilterPattern", "tableFilterPattern"}


def owned_schema_pattern(sources: tuple[BigQuerySource, ...]) -> dict[str, list[str]]:
    return {"includes": [f"^{re.escape(source.dataset)}$" for source in sources]}


def _connection(*, project_envs: tuple[str, ...], instance: BigQueryInstance) -> dict[str, Any]:
    refs = [Env(key).ref() for key in project_envs]
    project_id = refs[0] if len(refs) == 1 else refs
    if instance.auth == ADC_AUTH:
        gcp_config: dict[str, Any] = {"type": "gcp_adc", "projectId": project_id}
    else:
        gcp_config = {
            "type": "service_account",
            "projectId": project_id,
            "privateKeyId": Env("E2E_BQ_PRIVATE_KEY_ID").ref(),
            "privateKey": Env(CLI_PRIVATE_KEY_ENV).ref(),
            "clientEmail": Env("E2E_BQ_CLIENT_EMAIL").ref(),
        }
    connection: dict[str, Any] = {
        "type": "BigQuery",
        "credentials": {"gcpConfig": gcp_config},
        # INFORMATION_SCHEMA.JOBS/ROUTINES are regional; the owned datasets live in this location.
        "usageLocation": instance.location.lower(),
    }
    if len(refs) == 1:
        # Mirrors the v1 single-project config: metadata/profiler jobs are billed to the second project.
        connection["billingProjectId"] = Env(SECONDARY_PROJECT_ENV).ref()
    return connection


def _require_owned(sources: tuple[BigQuerySource, ...], instance: BigQueryInstance) -> tuple[str, ...]:
    if not isinstance(sources, tuple) or not sources:
        raise ValueError("sources must be a nonempty tuple of owned BigQuery sources")
    for source in sources:
        source.require_active()
        if instance.project(source.project_id) is not source.project:
            raise ValueError("All BigQuery sources must belong to the session's E2E projects")
    if len({(source.project_id, source.dataset) for source in sources}) != len(sources):
        raise ValueError("BigQuery sources must be distinct datasets")
    envs = []
    for source in sources:
        if source.project.env_key not in envs:
            envs.append(source.project.env_key)
    if len(envs) == 1 and envs[0] != PRIMARY_PROJECT_ENV:
        raise ValueError("A single-project run must use the primary E2E project")
    return tuple(envs)


def bigquery_invocation(
    *,
    service_name: str,
    sources: tuple[BigQuerySource, ...],
    instance: BigQueryInstance,
    options: PipelineOptions,
    filters: dict[str, Any],
    server: ServerConfig,
) -> WorkflowInvocation:
    """Scope every workflow to explicitly owned datasets; the projects also hold unowned data."""
    project_envs = _require_owned(sources, instance)
    if filters.keys() - _FILTERS:
        raise ValueError(f"Unsupported filter fields: {sorted(filters.keys() - _FILTERS)}")
    if "schemaFilterPattern" in type(options).model_fields:
        schema_pattern = filters.get("schemaFilterPattern", owned_schema_pattern(sources))
        if not schema_pattern.get("includes"):
            raise ValueError("schemaFilterPattern must include owned datasets explicitly")
        filters = {**filters, "schemaFilterPattern": schema_pattern}
    elif filters:
        raise ValueError(f"{type(options).__name__} does not accept filters")
    return database_invocation(
        source_type="bigquery",
        service_name=service_name,
        service_connection=_connection(project_envs=project_envs, instance=instance),
        server=server,
        options=type(options).model_validate({**options.model_dump(), **filters}),
    )


def table_diff_invocation(
    base: WorkflowInvocation, *, service_name: str, test_cases: list[TestCaseDefinition]
) -> WorkflowInvocation:
    """Move the connection into sourceConfig and attach test definitions, as the test workflow expects."""
    source = base.config["source"]
    connection = source.pop("serviceConnection")
    source["sourceConfig"]["config"]["serviceConnections"] = [
        {"serviceName": service_name, "serviceConnection": connection}
    ]
    base.config["processor"] = {
        "type": "orm-test-runner",
        "config": {"testCases": [case.model_dump(mode="json", exclude_none=True) for case in test_cases]},
    }
    return base


@dataclass(frozen=True)
class BigQueryContext:
    source: BigQuerySource
    instance: BigQueryInstance
    service_name: str
    server: ServerConfig
    om: OpenMetadata

    def invocation(
        self,
        options: PipelineOptions,
        *,
        filters: dict[str, Any] | None = None,
        sources: tuple[BigQuerySource, ...] | None = None,
    ) -> WorkflowInvocation:
        return bigquery_invocation(
            service_name=self.service_name,
            sources=(self.source,) if sources is None else sources,
            instance=self.instance,
            options=options,
            filters={} if filters is None else filters,
            server=self.server,
        )

    def table_diff_invocation(self, table: str, test_cases: list[TestCaseDefinition]) -> WorkflowInvocation:
        return table_diff_invocation(
            self.invocation(TestPipeline(type="TestSuite", entityFullyQualifiedName=self.table_fqn(table))),
            service_name=self.service_name,
            test_cases=test_cases,
        )

    def table_fqn(self, name: str) -> str:
        parts = (self.service_name, self.source.project_id, self.source.dataset, name)
        return ".".join(quote_name(part) for part in parts)

    def column_fqn(self, table: str, column: str) -> str:
        return f"{self.table_fqn(table)}.{quote_name(column)}"

    def table_query(self, name: str) -> Query[Table | None]:
        return table_query(self.om, self.table_fqn(name))

    def profile_query(self, name: str) -> Query[Table | None]:
        return profile_query(self.om, self.table_fqn(name))

    def catalog_query(self) -> Query[CatalogSnapshot]:
        return Query(f"catalog for {self.service_name}", lambda: read_catalog(self.om, self.service_name))
