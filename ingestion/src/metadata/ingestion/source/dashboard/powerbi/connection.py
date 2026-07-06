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

    The REST client raises ``APIError`` carrying the response status on its
    ``.status_code`` property; we walk the cause chain and match on it. The status
    is the stable signal - the message body varies by tenant and endpoint."""
    wanted = frozenset(codes)

    def match(error: BaseException) -> bool:
        result = False
        for current in exception_chain(error):
            code = getattr(current, "status_code", None)
            if isinstance(code, int) and code in wanted:
                result = True
        return result

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
    then exercises list access. No network call happens at construction; each
    ``@check`` builds and runs its own call.
    """

    errors = POWERBI_ERRORS

    def __init__(self, client: PowerBiClient) -> None:
        self.client = client

    @check(DashboardStep.CheckAccess)
    def check_access(self) -> Evidence:
        return verify_access(
            self.client.api_client.get_auth_token,
            command="acquire OAuth token",
        )

    @check(DashboardStep.GetDashboards)
    def get_dashboards(self) -> Evidence:
        return fetch_list(
            self.client.api_client.fetch_dashboards,
            noun="dashboard",
            command="fetch dashboards",
        )


class PowerBIConnection(BaseConnection[PowerBIConnectionConfig, PowerBiClient]):
    def _get_client(self) -> PowerBiClient:
        return get_connection(self.service_connection)

    def checks(self) -> ChecksProvider:
        return PowerBIChecks(client=self.client)
