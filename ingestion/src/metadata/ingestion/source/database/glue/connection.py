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
"""
Source connection handler for the AWS Glue Data Catalog.

Glue has no SQL engine and no host:port: a check's reported ``command`` is the
boto3 API operation it exercised, and failures arrive as botocore ``ClientError``s.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from metadata.clients.aws_client import AWSClient
from metadata.core.connections.test_connection import ErrorPack, check, when
from metadata.core.connections.test_connection.aws import AWS_ERRORS, aws_code
from metadata.core.connections.test_connection.check import CheckError
from metadata.core.connections.test_connection.checks.database import DatabaseStep
from metadata.core.connections.test_connection.checks.summary import count, enumerated, more_suffix
from metadata.core.connections.test_connection.records import Diagnosis, Evidence
from metadata.generated.schema.entity.services.connections.database.glueConnection import (
    GlueConnection as GlueConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.utils.filters import filter_by_database, filter_by_schema, filter_by_table

if TYPE_CHECKING:
    from collections.abc import Iterator

    from metadata.core.connections.lifetime import Borrowed
    from metadata.core.connections.test_connection import ChecksProvider
    from metadata.generated.schema.type.filterPattern import FilterPattern


# A check only needs to prove the catalog can be listed, not enumerate all of it.
DEFAULT_LIST_LIMIT = 100

# Catalogs commonly lead with an empty 'default' database, so the table probe keeps
# looking past it - bounded, since each database costs a GetTables call.
MAX_DATABASES_TO_PROBE = 10


# Only what is specific to Glue: its IAM actions and its not-found code.
# Authentication, region, endpoint and network failures come from AWS_ERRORS.
GLUE_ERRORS = ErrorPack(
    when(aws_code("AccessDenied", "AccessDeniedException")).diagnose(
        "Not authorized",
        fix="Grant glue:GetDatabases and glue:GetTables to the identity used, and check any "
        "Lake Formation permissions on the catalog.",
    ),
    # Only from GetTables; a GetDatabases listing returns an empty list instead.
    when(aws_code("EntityNotFoundException")).diagnose(
        "Glue database not found",
        fix="The database disappeared from the catalog while the connection was being tested; re-run the test.",
    ),
).including(AWS_ERRORS)


def _paginate(client: Any, operation: str, key: str, limit: int, **kwargs: Any) -> list[Any]:
    """Return at most ``limit + 1`` items - one past the cap, so the caller can
    report "more exist" without crawling the whole catalog."""
    paginator = client.get_paginator(operation)
    pages = paginator.paginate(PaginationConfig={"MaxItems": limit + 1}, **kwargs)
    return [item for page in pages for item in page.get(key, [])]


def list_databases(client: Any, limit: int = DEFAULT_LIST_LIMIT) -> Evidence:
    """Enumerate the Glue databases the identity can see, reporting at most ``limit``.

    Lake Formation filters the response instead of raising, so zero grants read
    exactly like an empty catalog: both surface as a caveat, never a failure."""
    command = "glue:GetDatabases"
    try:
        databases = _paginate(client, "get_databases", "DatabaseList", limit)
    except Exception as cause:
        raise CheckError(cause, Evidence(command=command)) from cause
    caveat = None
    if not databases:
        caveat = Diagnosis(
            title="No databases visible",
            remediation="The catalog in awsRegion may be empty, or Lake Formation may be filtering "
            "it out: grant the identity DESCRIBE on the databases it should read. Ingestion would "
            "collect nothing as configured.",
        )
    shown = min(len(databases), limit)
    summary = enumerated(shown, "database") + more_suffix(shown, len(databases) > limit)
    return Evidence(summary=summary, command=command, caveat=caveat)


@dataclass(frozen=True)
class GlueFilters:
    """The connection's filter patterns, matched as ingestion matches them: the
    database pattern against the catalog ID, the schema pattern against the Glue
    database name and the table pattern against the table name."""

    database: FilterPattern | None = None
    schema: FilterPattern | None = None
    table: FilterPattern | None = None

    @classmethod
    def of(cls, connection: GlueConnectionConfig) -> GlueFilters:
        # With databaseName set, ingestion labels every catalog with it and skips the database filter.
        return cls(
            database=None if connection.databaseName else connection.databaseFilterPattern,
            schema=connection.schemaFilterPattern,
            table=connection.tableFilterPattern,
        )

    def excludes_database(self, database: dict[str, Any]) -> bool:
        catalog_id = database.get("CatalogId")
        return bool(catalog_id and filter_by_database(self.database, catalog_id)) or filter_by_schema(
            self.schema, database["Name"]
        )


def _targeted_databases(client: Any, filters: GlueFilters) -> Iterator[dict[str, Any]]:
    """Yield the Glue databases ingestion would read, at most ``MAX_DATABASES_TO_PROBE``.

    The filters apply while paging, not after a capped listing: the targeted
    database can sort well past the cap, and a database the filters exclude - one
    the identity may not even be allowed to read - must never be probed."""
    probed = 0
    for page in client.get_paginator("get_databases").paginate():
        for database in page.get("DatabaseList", []):
            if filters.excludes_database(database):
                continue
            yield database
            probed += 1
            if probed >= MAX_DATABASES_TO_PROBE:
                return


def _targeted_tables(client: Any, database: dict[str, Any], filters: GlueFilters, limit: int) -> list[Any]:
    """Return at most ``limit + 1`` of the database's tables the table filter keeps,
    paging past excluded ones rather than counting them against the cap."""
    kwargs = {"DatabaseName": database["Name"]}
    # Name the database's own catalog, as ingestion does.
    if database.get("CatalogId"):
        kwargs["CatalogId"] = database["CatalogId"]
    tables = []
    for page in client.get_paginator("get_tables").paginate(**kwargs):
        for table in page.get("TableList", []):
            if filter_by_table(filters.table, table["Name"]):
                continue
            tables.append(table)
            if len(tables) > limit:
                return tables
    return tables


def list_tables(client: Any, filters: GlueFilters | None = None, limit: int = DEFAULT_LIST_LIMIT) -> Evidence:
    """Prove tables can be listed, probing the databases the connection's filters
    target until one exposes a table they keep.

    Stopping at the first database would report zero tables for a healthy catalog
    that merely leads with an empty one. Nothing here fails the step: an empty
    catalog is already flagged by ``list_databases``, and Lake Formation returns an
    empty list rather than an error when grants are missing."""
    filters = filters or GlueFilters()
    command = "glue:GetDatabases"
    probed = 0
    try:
        for database in _targeted_databases(client, filters):
            probed += 1
            name = database["Name"]
            command = f"glue:GetTables (DatabaseName={name})"
            tables = _targeted_tables(client, database, filters, limit)
            if tables:
                shown = min(len(tables), limit)
                summary = f"{count(shown, 'table')} in database '{name}'" + more_suffix(shown, len(tables) > limit)
                return Evidence(summary=summary, command=command)
    except Exception as cause:
        raise CheckError(cause, Evidence(command=command)) from cause
    if not probed:
        return Evidence(summary="no databases available to probe", command=command, caveat=_no_tables_caveat())
    return Evidence(
        summary=f"no tables in the first {count(probed, 'database')}",
        command=command,
        caveat=_no_tables_caveat(),
    )


def _no_tables_caveat() -> Diagnosis:
    return Diagnosis(
        title="No tables visible",
        remediation="No database exposed a table. Verify the identity's Glue permissions and any "
        "Lake Formation DESCRIBE grants, and that databaseFilterPattern, schemaFilterPattern and "
        "tableFilterPattern are not excluding everything; ingestion would collect nothing as configured.",
    )


class GlueChecks:
    """Test-connection checks for the Glue Data Catalog.

    Reading the borrowed client is what builds it, so an assume-role config's STS
    handshake stays behind the gate."""

    errors = GLUE_ERRORS

    def __init__(self, catalog: Borrowed[Any], filters: GlueFilters | None = None) -> None:
        self._catalog = catalog
        self._filters = filters or GlueFilters()

    @check(DatabaseStep.GetDatabases)
    def get_databases(self) -> Evidence:
        return list_databases(self._catalog.client)

    @check(DatabaseStep.GetTables)
    def get_tables(self) -> Evidence:
        return list_tables(self._catalog.client, self._filters)


class GlueConnection(BaseConnection[GlueConnectionConfig, Any]):
    def _get_client(self) -> Any:
        return AWSClient(self.service_connection.awsConfig).get_glue_client()

    def checks(self) -> ChecksProvider:
        return GlueChecks(
            catalog=self.borrow(),
            filters=GlueFilters.of(self.service_connection),
        )
