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

Glue has no SQL engine and no host:port: the catalog is reached through the boto3
Glue client, so a check's reported ``command`` is the API operation it exercised
(``glue:GetDatabases``, ``glue:GetTables``) and failures arrive as botocore
``ClientError``s carrying a structured AWS error code.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from metadata.clients.aws_client import AWSClient
from metadata.core.connections.test_connection import ErrorPack, check, when
from metadata.core.connections.test_connection.aws import AWS_ERRORS, aws_code
from metadata.core.connections.test_connection.check import CheckError
from metadata.core.connections.test_connection.checks.database import DatabaseStep
from metadata.core.connections.test_connection.records import Diagnosis, Evidence
from metadata.generated.schema.entity.services.connections.database.glueConnection import (
    GlueConnection as GlueConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection

if TYPE_CHECKING:
    from collections.abc import Callable

    from metadata.core.connections.test_connection import ChecksProvider


# A check only needs to prove the catalog can be listed, not enumerate all of it.
DEFAULT_LIST_LIMIT = 100


# Only what is specific to Glue: its IAM actions and its not-found code.
# Authentication, region, endpoint and network failures come from AWS_ERRORS.
GLUE_ERRORS = ErrorPack(
    when(aws_code("AccessDenied", "AccessDeniedException")).diagnose(
        "Not authorized",
        fix="Grant glue:GetDatabases and glue:GetTables to the identity used, and check any "
        "Lake Formation permissions on the catalog.",
    ),
    # Raised by GetTables when the database vanished between listing and probing it;
    # a plain GetDatabases listing (no CatalogId) returns an empty list instead.
    when(aws_code("EntityNotFoundException")).diagnose(
        "Glue database not found",
        fix="The database disappeared from the catalog while the connection was being tested; re-run the test.",
    ),
).including(AWS_ERRORS)


def _count(n: int, noun: str) -> str:
    """``3 tables`` / ``1 table`` - pluralize the noun to match the count."""
    return f"{n} {noun if n == 1 else noun + 's'}"


def _more_suffix(shown: int, more: bool) -> str:
    """Mark a summary as capped when the catalog holds more assets beyond ``shown``."""
    return f" (showing first {shown}; more exist)" if more else ""


def _paginate(client: Any, operation: str, key: str, limit: int, **kwargs: Any) -> list[Any]:
    """Return at most ``limit + 1`` items of a Glue listing - one past the cap, so
    the caller can report "more exist" without crawling the whole catalog."""
    paginator = client.get_paginator(operation)
    pages = paginator.paginate(PaginationConfig={"MaxItems": limit + 1}, **kwargs)
    return [item for page in pages for item in page.get(key, [])]


def list_databases(client: Any, limit: int = DEFAULT_LIST_LIMIT) -> Evidence:
    """Enumerate the Glue databases the identity can see, reporting at most ``limit``.

    An empty catalog never raises, so it surfaces as a non-blocking caveat. A
    missing IAM action raises ``AccessDeniedException`` and fails the step, but
    Lake Formation instead filters the response down to what the caller may see -
    so zero grants read exactly like an empty catalog, and only a caveat can
    distinguish them for the user."""
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
    summary = f"{_count(shown, 'database')} enumerated" + _more_suffix(shown, len(databases) > limit)
    return Evidence(summary=summary, command=command, caveat=caveat)


def list_tables(client: Any, limit: int = DEFAULT_LIST_LIMIT) -> Evidence:
    """Prove tables can be listed, probing the first database the catalog exposes.

    With no database to probe, ``glue:GetTables`` cannot run: that is a caveat, not
    a failure - the empty catalog is already flagged by ``list_databases``."""
    command = "glue:GetDatabases"
    try:
        databases = _paginate(client, "get_databases", "DatabaseList", 1)
        if not databases:
            return Evidence(
                summary="no databases available to probe",
                command=command,
                caveat=Diagnosis(
                    title="No tables probed",
                    remediation="The catalog exposes no database to list tables from; create one, "
                    "or verify the identity can see it.",
                ),
            )
        database_name = databases[0]["Name"]
        command = f"glue:GetTables (DatabaseName={database_name})"
        tables = _paginate(client, "get_tables", "TableList", limit, DatabaseName=database_name)
    except Exception as cause:
        raise CheckError(cause, Evidence(command=command)) from cause
    shown = min(len(tables), limit)
    summary = f"{_count(shown, 'table')} in database '{database_name}'" + _more_suffix(shown, len(tables) > limit)
    return Evidence(summary=summary, command=command)


class GlueChecks:
    """Test-connection checks for the Glue Data Catalog.

    The client is built lazily inside the checks: an assume-role config calls STS
    while the boto3 session is created, so building it at provider construction
    would touch the network before the gate, outside the per-step timeout."""

    errors = GLUE_ERRORS

    def __init__(self, connect: Callable[[], Any]) -> None:
        self._connect = connect

    @check(DatabaseStep.GetDatabases)
    def get_databases(self) -> Evidence:
        return list_databases(self._connect())

    @check(DatabaseStep.GetTables)
    def get_tables(self) -> Evidence:
        return list_tables(self._connect())


class GlueConnection(BaseConnection[GlueConnectionConfig, Any]):
    def _get_client(self) -> Any:
        return AWSClient(self.service_connection.awsConfig).get_glue_client()

    def checks(self) -> ChecksProvider:
        return GlueChecks(connect=lambda: self.client)
