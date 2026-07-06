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
Source connection handler
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from metadata.core.connections.test_connection import (
    ErrorPack,
    Evidence,
    Matchers,
    check,
    when,
)
from metadata.core.connections.test_connection.checks.dashboard import (
    DashboardStep,
    fetch_list,
    verify_access,
)
from metadata.core.connections.test_connection.classifier import exception_chain
from metadata.core.connections.test_connection.network import NETWORK_ERRORS
from metadata.generated.schema.entity.services.connections.dashboard.powerBIConnection import (
    PowerBIConnection as PowerBIConnectionConfig,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.dashboard.powerbi.client import (
    PowerBiApiClient,
    PowerBiClient,
)
from metadata.ingestion.source.dashboard.powerbi.file_client import PowerBiFileClient

if TYPE_CHECKING:
    from metadata.core.connections.test_connection import ChecksProvider
    from metadata.core.connections.test_connection.classifier import Matcher


def _http_status(*codes: int) -> Matcher:
    """Match a PowerBI REST error by HTTP status.

    The status is the stable signal - the message body varies by tenant and
    endpoint. Two shapes carry it: the client's ``APIError`` exposes it on a
    top-level ``.status_code`` property, but when the error body has no ``code``
    field the client re-raises the raw ``requests.HTTPError`` unchanged, which
    carries the status at ``.response.status_code``. We consult both, across the
    cause chain."""
    wanted = frozenset(codes)

    def match(error: BaseException) -> bool:
        for current in exception_chain(error):
            code = getattr(current, "status_code", None)
            if code is None:
                response = getattr(current, "response", None)
                code = getattr(response, "status_code", None)
            if isinstance(code, int) and code in wanted:
                return True
        return False

    return match


def _contains_any(*tokens: str) -> Matcher:
    """Match when any of ``tokens`` appears in the error (or its cause chain).

    MSAL reports a bad authority through more than one message shape - a malformed
    tenant, a blank tenant - so a single ``Matchers.contains`` token would miss
    some; this ORs the stable tokens across those shapes."""
    lowered = tuple(token.lower() for token in tokens)

    def match(error: BaseException) -> bool:
        chain = " ".join(str(current) for current in exception_chain(error)).lower()
        return any(token in chain for token in lowered)

    return match


POWERBI_ERRORS = ErrorPack(
    when(_http_status(401)).diagnose(
        "Authentication failed",
        fix="The service principal token was rejected (401). Check the Client ID, Client Secret, "
        "and Tenant ID, and that the secret has not expired.",
    ),
    when(Matchers.exception(InvalidSourceException)).diagnose(
        "Authentication failed",
        fix="Could not acquire an OAuth token. Check the Client ID, Client Secret, and Tenant ID, "
        "and that the app registration is allowed to request the configured scope.",
    ),
    when(_http_status(403)).diagnose(
        "Insufficient permissions",
        fix="The token authenticated but is not authorized (403). Grant the service principal the "
        "required Power BI tenant settings / admin API access, and enable service-principal access "
        "in the Power BI admin portal.",
    ),
    when(_http_status(404)).diagnose(
        "Resource not found",
        fix="The requested resource was not found (404). Check the API URL and that the configured "
        "tenant/workspace exists and is visible to the service principal.",
    ),
    # Kept last: authority/instance-discovery failures are MSAL ValueErrors that
    # carry no HTTP status, so a broad substring match here must not shadow a
    # status-coded 401/403/404 whose message happens to echo the authority URL.
    when(_contains_any("authority", "should consist of an https url")).diagnose(
        "Invalid tenant or authority",
        fix="The authority could not be resolved. Check the Tenant ID (a valid GUID or "
        "tenant name) and the Authority URI, e.g. https://login.microsoftonline.com/.",
    ),
).including(NETWORK_ERRORS)


def get_connection(connection: PowerBIConnectionConfig) -> PowerBiClient:
    """
    Create connection
    """
    file_client = None
    if connection.pbitFilesSource:
        file_client = PowerBiFileClient(connection)
    return PowerBiClient(api_client=PowerBiApiClient(connection), file_client=file_client)


class PowerBIChecks:
    """Test-connection checks for PowerBI.

    ``CheckAccess`` is the gate: it acquires an OAuth token, so a bad service
    principal fails fast before any list endpoint is dialled. ``GetDashboards``
    then exercises list access.

    The REST client is built lazily inside the first check, never at
    construction: the underlying MSAL client performs authority/instance
    discovery over the network in its constructor, so building it eagerly would
    run before the runner's gate and surface as a raw workflow error instead of a
    classified ``CheckAccess`` failure.
    """

    errors = POWERBI_ERRORS

    def __init__(self, connection: PowerBIConnectionConfig) -> None:
        self._connection = connection
        self._api_client: PowerBiApiClient | None = None

    def _client(self) -> PowerBiApiClient:
        """Build (once) and return the REST client. Built directly rather than via
        ``get_connection`` so the file client (unused by the checks) is never
        constructed. The MSAL client it wraps does authority/instance discovery
        over the network in its constructor, so this is only ever called from
        inside a check - never at construction."""
        if self._api_client is None:
            self._api_client = PowerBiApiClient(self._connection)
        return self._api_client

    @check(DashboardStep.CheckAccess)
    def check_access(self) -> Evidence:
        return verify_access(
            lambda: self._client().get_auth_token(),
            command="acquire OAuth token",
        )

    @check(DashboardStep.GetDashboards)
    def get_dashboards(self) -> Evidence:
        return fetch_list(
            self._client().fetch_dashboards,
            noun="dashboard",
            command="fetch dashboards",
        )


class PowerBIConnection(BaseConnection[PowerBIConnectionConfig, PowerBiClient]):
    def _get_client(self) -> PowerBiClient:
        return get_connection(self.service_connection)

    def checks(self) -> ChecksProvider:
        return PowerBIChecks(connection=self.service_connection)
