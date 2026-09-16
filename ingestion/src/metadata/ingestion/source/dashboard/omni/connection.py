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

from requests.exceptions import SSLError

from metadata.core.connections.test_connection import (
    ErrorPack,
    Evidence,
    Matchers,
    check,
    when,
)
from metadata.core.connections.test_connection.checks.dashboard import DashboardStep
from metadata.core.connections.test_connection.checks.rest import (
    call_endpoint,
    http_status,
    verify_access,
)
from metadata.core.connections.test_connection.network import NETWORK_ERRORS
from metadata.generated.schema.entity.services.connections.dashboard.omniConnection import (
    OmniConnection as OmniConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.dashboard.omni.client import OmniApiClient
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_manager import SSLManager
from metadata.utils.ssl_registry import get_verify_ssl_fn

if TYPE_CHECKING:
    from metadata.core.connections.lifetime import Borrowed
    from metadata.core.connections.test_connection import ChecksProvider

logger = ingestion_logger()


OMNI_ERRORS = ErrorPack(
    when(http_status(401)).diagnose(
        "Authentication failed",
        fix="Omni rejected the API token (401). Check the token value and that it has not been "
        "revoked, and that Host Port points at your Omni organization (https://<org>.omniapp.co).",
    ),
    when(http_status(403)).diagnose(
        "Insufficient permissions",
        fix="The token is valid but not authorized (403). Use an organization API token that can "
        "read models and documents.",
    ),
    when(http_status(429)).diagnose(
        "Rate limit reached",
        fix="Omni throttled the request (429). The default limit is 60 requests/min; wait and "
        "retry, or ask Omni to raise the limit for the API key.",
    ),
    when(Matchers.exception(SSLError)).diagnose(
        "TLS verification failed",
        fix="The server's certificate could not be verified. Provide the CA certificate under SSL "
        "Config with Verify SSL set to 'validate', or set Verify SSL to 'ignore' for a "
        "self-signed certificate.",
    ),
).including(NETWORK_ERRORS)


def get_connection(connection: OmniConnectionConfig) -> OmniApiClient:
    """
    Create the Omni REST client.

    SSL verification is resolved through the shared registry so the platform
    semantics are respected: ``no-ssl`` uses the system CAs (None), ``ignore``
    disables verification (False) and ``validate`` uses the provided CA.
    """
    try:
        verify_ssl = None
        if connection.verifySSL:
            verify_ssl = get_verify_ssl_fn(connection.verifySSL)(connection.sslConfig)
            # `validate` returns the raw CA certificate *content*, but requests
            # treats a string ``verify`` value as a path to a CA bundle. Write the
            # certificate to a temp file (kept for the session) and pass its path.
            if isinstance(verify_ssl, str) and connection.sslConfig:
                verify_ssl = SSLManager(ca=connection.sslConfig.root.caCertificate).ca_file_path
        return OmniApiClient(connection, verify_ssl=verify_ssl)
    except Exception as exc:
        msg = f"Unknown error connecting with {connection}: {exc}."
        raise SourceConnectionException(msg) from exc


class OmniChecks:
    """Test-connection checks for Omni.

    ``CheckAccess`` is the gate: reading the borrowed client and hitting the
    models endpoint authenticates, so a bad token or unreachable host fails
    there and ``GetDashboards`` is skipped.
    """

    errors = OMNI_ERRORS

    def __init__(self, client: Borrowed[OmniApiClient]) -> None:
        self._client = client

    @check(DashboardStep.CheckAccess)
    def check_access(self) -> Evidence:
        # Lambda, not a bound method: the request must run inside verify_access's
        # try so a bad token/host is caught and classified.
        return verify_access(
            lambda: self._client.client.test_access(),  # noqa: PLW0108
            command="authenticate and list models",
        )

    @check(DashboardStep.GetDashboards)
    def get_dashboards(self) -> Evidence:
        command = "list documents"
        call_endpoint(lambda: self._client.client.test_get_documents(), command=command)  # noqa: PLW0108
        return Evidence(summary="documents are readable", command=command)


class OmniConnection(BaseConnection[OmniConnectionConfig, OmniApiClient]):
    # Omni is rate-limited (60 req/min by default); keep a generous per-step
    # budget so a throttled test does not fail spuriously.
    step_timeout_seconds = THREE_MIN

    def _get_client(self) -> OmniApiClient:
        client = get_connection(self.service_connection)
        # Release the underlying HTTP session when the connection is closed.
        self._on_close(client.close)
        return client

    def checks(self) -> ChecksProvider:
        return OmniChecks(client=self.borrow())
