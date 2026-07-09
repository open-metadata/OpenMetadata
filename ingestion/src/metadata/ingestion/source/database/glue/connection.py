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

Glue exposes no SQL engine and no host:port: the catalog is reached through the
boto3 Glue client, so the reported ``command`` is the API operation a check
exercised (e.g. ``glue:GetDatabases``) and failures arrive as botocore
``ClientError``s carrying a structured AWS error code.

The test-connection steps exercise ``glue:GetDatabases`` and ``glue:GetTables``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from botocore.exceptions import (
    EndpointConnectionError,
    NoCredentialsError,
    NoRegionError,
)

from metadata.clients.aws_client import AWSClient
from metadata.core.connections.test_connection import ErrorPack, Matchers, check, when
from metadata.core.connections.test_connection.check import CheckError
from metadata.core.connections.test_connection.checks.database import DatabaseStep
from metadata.core.connections.test_connection.classifier import exception_chain
from metadata.core.connections.test_connection.network import NETWORK_ERRORS
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


def aws_error_code(*codes: str) -> Callable[[BaseException], bool]:
    """Match a botocore ``ClientError`` by its structured AWS error code.

    botocore carries the code at ``error.response['Error']['Code']``; matching
    that is sturdier than a substring search of the message (a database name or
    message text echoing a code cannot false-match) and mirrors how the framework
    matches errno / status_code elsewhere. Walks the cause chain like the other
    matchers.
    """
    wanted = frozenset(codes)

    def match(error: BaseException) -> bool:
        for current in exception_chain(error):
            response = getattr(current, "response", None)
            if isinstance(response, dict) and response.get("Error", {}).get("Code") in wanted:
                return True
        return False

    return match


GLUE_ERRORS = ErrorPack(
    when(aws_error_code("InvalidAccessKeyId")).diagnose(
        "Invalid AWS access key",
        fix="The awsAccessKeyId does not exist in AWS; check the configured credentials.",
    ),
    when(aws_error_code("SignatureDoesNotMatch", "InvalidSignatureException")).diagnose(
        "AWS secret key does not match",
        fix="The awsSecretAccessKey is wrong for this awsAccessKeyId; re-enter the credential pair.",
    ),
    when(aws_error_code("UnrecognizedClientException")).diagnose(
        "AWS credentials not recognized",
        fix="The security token or access key is invalid; check the configured credentials.",
    ),
    when(aws_error_code("InvalidClientTokenId")).diagnose(
        "AWS security token is invalid",
        fix="The awsSessionToken (or access key) is invalid for this region; refresh the credentials.",
    ),
    when(aws_error_code("ExpiredToken", "ExpiredTokenException")).diagnose(
        "AWS session token expired",
        fix="Temporary credentials have expired; refresh the awsSessionToken.",
    ),
    when(aws_error_code("AccessDenied", "AccessDeniedException")).diagnose(
        "Not authorized",
        fix="Grant glue:GetDatabases and glue:GetTables to the identity used, and check any "
        "Lake Formation permissions on the catalog.",
    ),
    when(aws_error_code("EntityNotFoundException")).diagnose(
        "Glue catalog entity not found",
        fix="The database or catalog does not exist in this account and region; check awsRegion "
        "and that the Glue Data Catalog is populated.",
    ),
    when(Matchers.exception(NoCredentialsError)).diagnose(
        "No AWS credentials found",
        fix="No credentials were configured or resolvable; set awsAccessKeyId/awsSecretAccessKey "
        "or make an IAM role available where ingestion runs.",
    ),
    when(Matchers.exception(NoRegionError)).diagnose(
        "No AWS region configured",
        fix="Set awsRegion; the Glue client cannot resolve an endpoint without it.",
    ),
    when(Matchers.exception(EndpointConnectionError)).diagnose(
        "Cannot reach the AWS endpoint",
        fix="Check awsRegion (and endPointURL when overridden), and that the network allows "
        "access to the Glue endpoint from where ingestion runs.",
    ),
).including(NETWORK_ERRORS)


def _count(n: int, noun: str) -> str:
    """``3 tables`` / ``1 table`` - pluralize the noun to match the count."""
    return f"{n} {noun if n == 1 else noun + 's'}"


def _more_suffix(shown: int, more: bool) -> str:
    """Mark a summary as capped when the catalog holds more assets beyond ``shown``."""
    return f" (showing first {shown}; more exist)" if more else ""


def _paginate(client: Any, operation: str, key: str, limit: int, **kwargs: Any) -> list[Any]:
    """Return at most ``limit + 1`` items of a Glue listing.

    One item past the cap is fetched so the caller can tell "exactly ``limit``"
    from "more exist" without pulling the whole catalog, which on a large account
    would turn a connection test into a long, paginated crawl.
    """
    paginator = client.get_paginator(operation)
    pages = paginator.paginate(PaginationConfig={"MaxItems": limit + 1}, **kwargs)
    return [item for page in pages for item in page.get(key, [])]


def list_databases(client: Any, limit: int = DEFAULT_LIST_LIMIT) -> Evidence:
    """Enumerate the Glue databases the identity can see, reporting at most ``limit``.

    An empty listing never raises - the catalog may simply hold no databases - so
    'none visible' surfaces as a non-blocking caveat for the user to judge. A
    missing permission is a different case: it raises ``AccessDeniedException``,
    which fails the step.
    """
    command = "glue:GetDatabases"
    try:
        databases = _paginate(client, "get_databases", "DatabaseList", limit)
    except Exception as cause:
        raise CheckError(cause, Evidence(command=command)) from cause
    caveat = None
    if not databases:
        caveat = Diagnosis(
            title="No databases visible",
            remediation="Verify the identity can read the Glue Data Catalog in awsRegion, "
            "and that the catalog holds at least one database.",
        )
    shown = min(len(databases), limit)
    summary = f"{_count(shown, 'database')} enumerated" + _more_suffix(shown, len(databases) > limit)
    return Evidence(summary=summary, command=command, caveat=caveat)


def list_tables(client: Any, limit: int = DEFAULT_LIST_LIMIT) -> Evidence:
    """Prove tables can be listed, probing the first database the catalog exposes.

    Glue has no configurable schema for this test, so the probed database is
    whichever one the catalog lists first; the summary names it. With no database
    to probe, ``glue:GetTables`` cannot be exercised: that reports as a caveat
    rather than a failure, since the empty catalog is already flagged by
    ``list_databases``.
    """
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

    The client is built lazily inside the checks: an assume-role configuration
    calls STS while the boto3 session is created, so building it while the
    provider is constructed would touch the network before the runner's gate
    (and outside its per-step timeout). ``connect`` is ``BaseConnection.client``
    underneath, so both steps share the one cached client.
    """

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
