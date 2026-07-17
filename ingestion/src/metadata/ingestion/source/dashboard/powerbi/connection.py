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
    Diagnosis,
    ErrorPack,
    Evidence,
    Matchers,
    check,
    when,
)
from metadata.core.connections.test_connection.checks.dashboard import DashboardStep
from metadata.core.connections.test_connection.checks.rest import (
    fetch_list,
    http_status,
    verify_access,
)
from metadata.core.connections.test_connection.classifier import chain_text
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
    from metadata.core.connections.lifetime import Borrowed
    from metadata.core.connections.test_connection import ChecksProvider
    from metadata.core.connections.test_connection.classifier import Matcher


def _contains_any(*tokens: str) -> Matcher:
    """Match when any of ``tokens`` appears in the error (or its cause chain).

    MSAL reports a bad authority through more than one message shape - a malformed
    tenant, a blank tenant - so a single ``Matchers.contains`` token would miss
    some; this ORs the stable tokens across those shapes."""
    lowered = tuple(token.lower() for token in tokens)

    def match(error: BaseException) -> bool:
        chain = chain_text(error)
        return any(token in chain for token in lowered)

    return match


POWERBI_ERRORS = ErrorPack(
    # CheckAccess acquires the OAuth token, so a bad secret fails there as an
    # InvalidSourceException - not here. Any 401/403 from a REST call therefore
    # means the token was accepted but Power BI would not authorize the call, so
    # neither diagnosis points at the credentials. Per Microsoft's REST API
    # troubleshooting guide, a service principal that is not enabled for the
    # (admin) APIs returns 401, while a missing workspace/resource grant returns
    # 403 - so the two split on tenant-enablement vs. workspace access.
    when(Matchers.exception(InvalidSourceException)).diagnose(
        "Authentication failed",
        fix="Could not acquire an OAuth token. Check the Client ID, Client Secret, and Tenant ID, "
        "and that the app registration is allowed to request the configured scope.",
    ),
    when(http_status(401)).diagnose(
        "Power BI did not authorize the service principal",
        fix="The token was accepted but Power BI rejected the call (401). In the Fabric admin "
        "portal enable 'Allow service principals to use Power BI APIs' (and the read-only admin "
        "APIs setting when Use Admin APIs is on), add the service principal to the allowed "
        "security group, and grant the app registration the required API permission.",
    ),
    when(http_status(403)).diagnose(
        "Insufficient permissions",
        fix="The service principal is authenticated but not authorized for this resource (403). "
        "Add it as a member (or admin) of the target workspace and grant the permissions the "
        "call needs.",
    ),
    when(http_status(404)).diagnose(
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


class PowerBIChecks:
    """Test-connection checks for PowerBI.

    ``CheckAccess`` is the gate: it acquires an OAuth token, so a bad service
    principal fails fast before any list endpoint is dialled. ``GetDashboards``
    then exercises list access.

    ``CheckAccess`` is the gate: reading the borrowed client does MSAL discovery
    and acquires the token, so a bad service principal fails there.
    """

    errors = POWERBI_ERRORS

    def __init__(self, powerbi: Borrowed[PowerBiClient]) -> None:
        self._powerbi = powerbi

    def _client(self) -> PowerBiApiClient:
        return self._powerbi.client.api_client

    @check(DashboardStep.CheckAccess)
    def check_access(self) -> Evidence:
        return verify_access(
            lambda: self._client().get_auth_token(),
            command="acquire OAuth token",
        )

    @check(DashboardStep.GetDashboards)
    def get_dashboards(self) -> Evidence:
        return fetch_list(
            lambda: self._client().fetch_dashboards(),
            noun="dashboard",
            command="fetch dashboards",
            empty_caveat=Diagnosis(
                title="No dashboards visible",
                remediation="The connection works but returned no dashboards. Confirm the service "
                "principal has access to a workspace that contains dashboards - an empty result can "
                "also mean the listing was filtered or could not be read.",
            ),
        )


class PowerBIConnection(BaseConnection[PowerBIConnectionConfig, PowerBiClient]):
    def _get_client(self) -> PowerBiClient:
        """
        Create connection
        """
        file_client = None
        if self.service_connection.pbitFilesSource:
            file_client = PowerBiFileClient(self.service_connection)
        return PowerBiClient(
            api_client=PowerBiApiClient(self.service_connection),
            file_client=file_client,
        )

    def checks(self) -> ChecksProvider:
        return PowerBIChecks(powerbi=self.borrow())
