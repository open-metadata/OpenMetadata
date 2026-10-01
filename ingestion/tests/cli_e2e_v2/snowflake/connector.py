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
"""Snowflake workflow configuration bound to explicit owned schemas."""

from __future__ import annotations

import os
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
from .source import (
    ACCOUNT_ENV,
    CLI_PRIVATE_KEY_ENV,
    DATABASE_ENV,
    PASSPHRASE_ENV,
    PASSWORD_AUTH,
    PASSWORD_ENV,
    ROLE_ENV,
    USERNAME_ENV,
    WAREHOUSE_ENV,
)

if TYPE_CHECKING:
    from metadata.data_quality.api.models import TestCaseDefinition
    from metadata.generated.schema.entity.data.table import Table
    from metadata.ingestion.ometa.ometa_api import OpenMetadata

    from ..features.database.pipelines import PipelineOptions
    from ..runtime.cli import WorkflowInvocation
    from ..server import ServerConfig
    from .source import AccountUsageShim, SnowflakeInstance, SnowflakeSource

_FILTERS = {"schemaFilterPattern", "tableFilterPattern"}
# Connection switches the Snowflake feature scenarios toggle.
_CONNECTION_OPTIONS = {"includeTransientTables", "includeStreams"}


def owned_schema_pattern(sources: tuple[SnowflakeSource, ...]) -> dict[str, list[str]]:
    return {"includes": [f"^{re.escape(source.schema)}$" for source in sources]}


def _connection(
    instance: SnowflakeInstance, *, account_usage: AccountUsageShim | None, options: dict[str, Any]
) -> dict[str, Any]:
    connection: dict[str, Any] = {
        "type": "Snowflake",
        "account": Env(ACCOUNT_ENV).ref(),
        "username": Env(USERNAME_ENV).ref(),
        "warehouse": Env(WAREHOUSE_ENV).ref(),
        "database": Env(DATABASE_ENV).ref(),
    }
    if os.environ.get(ROLE_ENV):
        connection["role"] = Env(ROLE_ENV).ref()
    if instance.auth == PASSWORD_AUTH:
        connection["password"] = Env(PASSWORD_ENV).ref()
    else:
        connection["privateKey"] = Env(CLI_PRIVATE_KEY_ENV).ref()
        if os.environ.get(PASSPHRASE_ENV):
            connection["snowflakePrivatekeyPassphrase"] = Env(PASSPHRASE_ENV).ref()
    if account_usage is not None:
        connection["accountUsageSchema"] = account_usage.name
    return {**connection, **options}


def _require_owned(sources: tuple[SnowflakeSource, ...], instance: SnowflakeInstance) -> None:
    if not isinstance(sources, tuple) or not sources:
        raise ValueError("sources must be a nonempty tuple of owned Snowflake sources")
    for source in sources:
        source.require_active()
        if source.instance is not instance:
            raise ValueError("All Snowflake sources must belong to the session's E2E account")
    if len({source.schema for source in sources}) != len(sources):
        raise ValueError("Snowflake sources must be distinct schemas")


def snowflake_invocation(
    *,
    service_name: str,
    sources: tuple[SnowflakeSource, ...],
    instance: SnowflakeInstance,
    options: PipelineOptions,
    filters: dict[str, Any],
    server: ServerConfig,
    connection: dict[str, Any] | None = None,
    account_usage: AccountUsageShim | None = None,
) -> WorkflowInvocation:
    """Scope every workflow to explicitly owned schemas, because the E2E database also holds unowned ones."""
    _require_owned(sources, instance)
    if filters.keys() - _FILTERS:
        raise ValueError(f"Unsupported filter fields: {sorted(filters.keys() - _FILTERS)}")
    connection = connection or {}
    if connection.keys() - _CONNECTION_OPTIONS:
        raise ValueError(f"Unsupported connection options: {sorted(connection.keys() - _CONNECTION_OPTIONS)}")
    if "schemaFilterPattern" in type(options).model_fields:
        schema_pattern = filters.get("schemaFilterPattern", owned_schema_pattern(sources))
        if not schema_pattern.get("includes"):
            raise ValueError("schemaFilterPattern must include owned schemas explicitly")
        filters = {**filters, "schemaFilterPattern": schema_pattern}
    elif filters:
        raise ValueError(f"{type(options).__name__} does not accept filters")
    return database_invocation(
        source_type="snowflake",
        service_name=service_name,
        service_connection=_connection(instance, account_usage=account_usage, options=connection),
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
class SnowflakeContext:
    """Owned source plus service identity. Entity names are Snowflake's stored, upper-case identifiers."""

    source: SnowflakeSource
    instance: SnowflakeInstance
    service_name: str
    server: ServerConfig
    om: OpenMetadata

    def invocation(
        self,
        options: PipelineOptions,
        *,
        filters: dict[str, Any] | None = None,
        sources: tuple[SnowflakeSource, ...] | None = None,
        connection: dict[str, Any] | None = None,
        account_usage: AccountUsageShim | None = None,
    ) -> WorkflowInvocation:
        return snowflake_invocation(
            service_name=self.service_name,
            sources=(self.source,) if sources is None else sources,
            instance=self.instance,
            options=options,
            filters={} if filters is None else filters,
            server=self.server,
            connection=connection,
            account_usage=account_usage,
        )

    def table_diff_invocation(self, table: str, test_cases: list[TestCaseDefinition]) -> WorkflowInvocation:
        return table_diff_invocation(
            self.invocation(TestPipeline(type="TestSuite", entityFullyQualifiedName=self.table_fqn(table))),
            service_name=self.service_name,
            test_cases=test_cases,
        )

    def schema_fqn(self, source: SnowflakeSource | None = None) -> str:
        schema = (source or self.source).schema
        return ".".join(quote_name(part) for part in (self.service_name, self.instance.database, schema))

    def table_fqn(self, name: str, source: SnowflakeSource | None = None) -> str:
        return f"{self.schema_fqn(source)}.{quote_name(name)}"

    def column_fqn(self, table: str, column: str) -> str:
        return f"{self.table_fqn(table)}.{quote_name(column)}"

    def table_query(self, name: str) -> Query[Table | None]:
        return table_query(self.om, self.table_fqn(name))

    def profile_query(self, name: str) -> Query[Table | None]:
        return profile_query(self.om, self.table_fqn(name))

    def catalog_query(self) -> Query[CatalogSnapshot]:
        return Query(f"catalog for {self.service_name}", lambda: read_catalog(self.om, self.service_name))
