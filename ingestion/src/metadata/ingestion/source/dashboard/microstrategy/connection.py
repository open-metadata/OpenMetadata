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
    fetch_list,
    http_status,
    verify_access,
)
from metadata.core.connections.test_connection.network import NETWORK_ERRORS
from metadata.generated.schema.entity.services.connections.dashboard.microStrategyConnection import (
    MicroStrategyConnection as MicroStrategyConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.dashboard.microstrategy.client import MicroStrategyClient
from metadata.utils.constants import THREE_MIN
from metadata.utils.ssl_manager import SSLManager
from metadata.utils.ssl_registry import get_verify_ssl_fn

if TYPE_CHECKING:
    from metadata.core.connections.lifetime import Borrowed
    from metadata.core.connections.test_connection import ChecksProvider


MICROSTRATEGY_ERRORS = ErrorPack(
    when(http_status(401)).diagnose(
        "Authentication failed",
        fix="MicroStrategy rejected the login (401). Check the username and password, and that Login Mode "
        "matches how the user signs in: 1 Standard, 8 Anonymous, 16 LDAP.",
    ),
    when(http_status(403)).diagnose(
        "Insufficient permissions",
        fix="The user signed in but may not read this object (403). Grant it the Use and Browse privileges "
        "on the projects to ingest.",
    ),
    when(http_status(404)).diagnose(
        "MicroStrategy Library API not found",
        fix="Host Port must be the server root, such as https://host:port. The connector appends "
        "/MicroStrategyLibrary/api, so do not include that path.",
    ),
    when(Matchers.exception(SSLError)).diagnose(
        "TLS verification failed",
        fix="The server's certificate could not be verified. Provide the CA certificate under SSL Config with "
        "Verify SSL set to 'validate', or set Verify SSL to 'ignore' for a self-signed certificate.",
    ),
).including(NETWORK_ERRORS)


def resolve_verify(connection: MicroStrategyConnectionConfig) -> tuple[bool | str | None, SSLManager | None]:
    """
    Map Verify SSL to a ``requests`` verify value: ``no-ssl`` keeps the system CAs (None),
    ``ignore`` disables verification and ``validate`` points at a file holding the given CA.
    """
    if not connection.verifySSL:
        return None, None
    verify = get_verify_ssl_fn(connection.verifySSL)(connection.sslConfig)
    if isinstance(verify, str) and connection.sslConfig:
        ssl_manager = SSLManager(ca=connection.sslConfig.root.caCertificate)
        return ssl_manager.ca_file_path, ssl_manager
    return verify, None


class MicroStrategyChecks:
    """Test-connection checks for MicroStrategy.

    ``GetToken`` is the gate: borrowing the client logs in, so bad credentials or an
    unreachable host fail there and the other steps are skipped.
    """

    errors = MICROSTRATEGY_ERRORS

    def __init__(self, client: Borrowed[MicroStrategyClient]) -> None:
        self._client = client

    @check(DashboardStep.GetToken)
    def get_token(self) -> Evidence:
        # Lambda, not a bound method: the login must happen inside verify_access's try.
        return verify_access(
            lambda: self._client.client.get_session_info(),  # noqa: PLW0108
            command="log in and read the session",
        )

    @check(DashboardStep.GetProjects)
    def get_projects(self) -> Evidence:
        return fetch_list(
            lambda: self._client.client.get_projects_list(),  # noqa: PLW0108
            noun="project",
            command="list projects",
        )

    @check(DashboardStep.GetDashboards)
    def get_dashboards(self) -> Evidence:
        command = "search the dossiers of the first project"

        def first_dossier() -> object:
            projects = self._client.client.get_projects_list()
            if not projects:
                return None
            return next(iter(self._client.client.iter_search_results(projects[0].id, page_size=1)), None)

        call_endpoint(first_dossier, command=command)
        return Evidence(summary="dossiers are searchable", command=command)


class MicroStrategyConnection(BaseConnection[MicroStrategyConnectionConfig, MicroStrategyClient]):
    step_timeout_seconds = THREE_MIN

    def _get_client(self) -> MicroStrategyClient:
        verify, ssl_manager = resolve_verify(self.service_connection)
        if ssl_manager:
            self._on_close(ssl_manager.cleanup_temp_files)
        client = MicroStrategyClient(self.service_connection, verify=verify)
        self._on_close(client.close_api_session)
        return client

    def checks(self) -> ChecksProvider:
        return MicroStrategyChecks(client=self.borrow())
