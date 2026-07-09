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

import traceback
from typing import TYPE_CHECKING, Any, Dict, Optional, Union  # noqa: UP035

import tableauserverclient as TSC  # noqa: N812
from requests.exceptions import SSLError

from metadata.core.connections.test_connection import (
    ErrorPack,
    Evidence,
    Matchers,
    check,
    when,
)
from metadata.core.connections.test_connection.checks.dashboard import (
    DashboardStep,
    call_endpoint,
    verify_access,
)
from metadata.core.connections.test_connection.classifier import exception_chain
from metadata.core.connections.test_connection.network import NETWORK_ERRORS
from metadata.generated.schema.entity.services.connections.dashboard.tableauConnection import (
    TableauConnection as TableauConnectionConfig,
)
from metadata.generated.schema.security.credentials.accessTokenAuth import (
    AccessTokenAuth,
)
from metadata.generated.schema.security.credentials.basicAuth import BasicAuth
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.dashboard.tableau.client import (
    TableauChartsException,
    TableauClient,
    TableauDataModelsException,
    TableauOwnersNotFound,
    TableauWorkBookException,
)
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_manager import SSLManager

if TYPE_CHECKING:
    from metadata.core.connections.test_connection import ChecksProvider
    from metadata.core.connections.test_connection.classifier import Matcher

logger = ingestion_logger()

METADATA_API_DOC = (
    "https://help.tableau.com/current/api/metadata_api/en-us/docs/meta_api_start.html"
    "#enable-the-tableau-metadata-api-for-tableau-server"
)


def _status_of(error: BaseException) -> int | None:
    """Return the HTTP status a Tableau error carries, if any.

    ``ServerResponseError`` reports a Tableau error code - a string whose first
    three digits are the HTTP status, e.g. ``401002`` - while
    ``InternalServerError`` puts the status itself on ``.code``. A raw ``requests``
    error carries it at ``.response.status_code``.
    """
    code = getattr(error, "code", None)
    if isinstance(code, bool):
        status = None
    elif isinstance(code, int):
        status = code
    elif isinstance(code, str) and code[:3].isdigit():
        status = int(code[:3])
    else:
        response = getattr(error, "response", None)
        status = getattr(response, "status_code", None)
    return status if isinstance(status, int) else None


def _http_status(*codes: int) -> Matcher:
    """Match a Tableau REST error by HTTP status, across the cause chain.

    The status is the stable signal - the summary and detail of a Tableau error
    vary by endpoint and server version.
    """
    wanted = frozenset(codes)
    return lambda error: any(_status_of(current) in wanted for current in exception_chain(error))


TABLEAU_ERRORS = ErrorPack(
    when(_http_status(401)).diagnose(
        "Authentication failed",
        fix="Tableau rejected the credentials (401). Check the Personal Access Token name and "
        "secret - a token expires after 15 consecutive days of no use and is revoked when "
        "regenerated - or the username and password, and that the Site Name matches the site "
        "those credentials belong to.",
    ),
    when(_http_status(403)).diagnose(
        "Insufficient permissions",
        fix="The credentials are valid but not authorized for this resource (403). Grant the user "
        "at least the Viewer site role and read access to the projects to ingest.",
    ),
    when(_http_status(404)).diagnose(
        "Resource not found",
        fix="Tableau could not find the requested resource (404). Check that Host Port points at "
        "the Tableau server or Tableau Cloud pod, and that the Site Name exists - for "
        "https://<server>/#/site/MarketingTeam/home the Site Name is 'MarketingTeam'.",
    ),
    when(Matchers.exception(SSLError)).diagnose(
        "TLS verification failed",
        fix="The server's certificate could not be verified. Provide the CA certificate under SSL "
        "Config with Verify SSL set to 'validate', or set Verify SSL to 'ignore' for a "
        "self-signed certificate.",
    ),
    when(Matchers.exception(TableauWorkBookException)).diagnose(
        "No workbooks visible",
        fix="The user is authenticated but no workbook could be read. Grant it access to at least "
        "one project containing workbooks.",
    ),
    when(Matchers.exception(TableauChartsException)).diagnose(
        "No views visible",
        fix="Workbooks are readable but their views are not. Grant the user the View permission on "
        "the workbooks to ingest; charts are ingested from workbook views.",
    ),
    when(Matchers.exception(TableauOwnersNotFound)).diagnose(
        "Owner information not available",
        fix="Owners could not be resolved. Grant the user permission to read users on the site, or "
        "disable owner ingestion in the service configuration.",
    ),
    when(Matchers.exception(TableauDataModelsException)).diagnose(
        "Data sources could not be read",
        fix="The Tableau Metadata API returned no data sources for the workbook. Enable the "
        "Metadata API on the Tableau instance.",
        doc=METADATA_API_DOC,
    ),
    when(Matchers.contains("in incorrect format")).diagnose(
        "Invalid Site Name",
        fix="The Site Name must be the site identifier, not a URL - for "
        "https://<server>/#/site/MarketingTeam/home enter 'MarketingTeam'.",
    ),
).including(NETWORK_ERRORS)


def get_connection(connection: TableauConnectionConfig) -> TableauClient:
    """
    Create connection
    """
    tableau_server_auth = build_server_config(connection)
    verify_ssl, ssl_manager = set_verify_ssl(connection)
    try:
        return TableauClient(
            tableau_server_auth=tableau_server_auth,
            config=connection,
            verify_ssl=verify_ssl,
            pagination_limit=connection.paginationLimit,
            ssl_manager=ssl_manager,
        )
    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise SourceConnectionException(f"Unknown error connecting with {connection}: {exc}.")  # noqa: B904


def set_verify_ssl(
    connection: TableauConnectionConfig,
) -> tuple[Union[bool, str], Optional[SSLManager]]:  # noqa: UP007, UP045
    """
    Set verify ssl based on connection configuration
    ref: https://tableau.github.io/server-client-python/docs/sign-in-out#handling-ssl-certificates-for-tableau-server
    """
    if connection.verifySSL.value == "no-ssl":
        return None, None

    if connection.verifySSL.value == "ignore":
        return False, None

    if connection.verifySSL.value == "validate":
        if not connection.sslConfig:
            raise ValueError(
                "SSL Config is required when verifySSL is set to 'validate'. "
                "Please provide CA certificate, SSL certificate, or SSL key."
            )

        ssl_manager = SSLManager(
            ca=connection.sslConfig.root.caCertificate,
            cert=connection.sslConfig.root.sslCertificate,
            key=connection.sslConfig.root.sslKey,
        )

        if ssl_manager.ca_file_path:
            return ssl_manager.ca_file_path, ssl_manager
        else:  # noqa: RET505
            return True, ssl_manager

    raise ValueError(
        f"Unsupported verifySSL value: {connection.verifySSL.value}. Expected one of ['no-ssl', 'ignore', 'validate']."
    )


def build_server_config(connection: TableauConnectionConfig) -> Dict[str, Dict[str, Any]]:  # noqa: UP006
    """
    Build client configuration
    Args:
        connection: configuration of Tableau Connection
    Returns:
        Client configuration
    """

    if isinstance(connection.authType, BasicAuth):
        tableau_auth = TSC.TableauAuth(
            username=connection.authType.username,
            password=connection.authType.password.get_secret_value(),
            site_id=connection.siteName if connection.siteName else "",
        )
    elif isinstance(connection.authType, AccessTokenAuth):
        tableau_auth = TSC.PersonalAccessTokenAuth(
            token_name=connection.authType.personalAccessTokenName,
            personal_access_token=connection.authType.personalAccessTokenSecret.get_secret_value(),
            site_id=connection.siteName if connection.siteName else "",
        )
    else:
        raise ValueError("Unsupported authentication type")  # noqa: TRY004

    return tableau_auth


class TableauChecks:
    """Test-connection checks for Tableau.

    ``ServerInfo`` is the gate: building the client signs in, so bad credentials,
    a wrong site, or an unreachable server fail there and the remaining steps are
    skipped rather than each re-dialling the host.

    The client is built lazily inside the first check, never at construction: its
    constructor signs in over the network, and doing that while the provider is
    assembled would run before the runner's gate and surface as a raw workflow
    error instead of a classified ``ServerInfo`` failure.
    """

    errors = TABLEAU_ERRORS

    def __init__(self, connection: TableauConnectionConfig) -> None:
        self._connection = connection
        self._tableau_client: TableauClient | None = None

    def _client(self) -> TableauClient:
        """Build (once) and return the signed-in client. Only ever called from
        inside a check, since signing in touches the network."""
        if self._tableau_client is None:
            self._tableau_client = get_connection(self._connection)
        return self._tableau_client

    @check(DashboardStep.ServerInfo)
    def server_info(self) -> Evidence:
        return verify_access(
            lambda: self._client().server_info(),
            command="sign in and read server info",
        )

    @check(DashboardStep.ValidateApiVersion)
    def validate_api_version(self) -> Evidence:
        command = "read the server REST API version"
        version = call_endpoint(lambda: self._client().server_api_version(), command=command)
        return Evidence(summary=f"REST API version {version}", command=command)

    @check(DashboardStep.ValidateSiteUrl)
    def validate_site_url(self) -> Evidence:
        command = "validate the configured site name"
        call_endpoint(lambda: self._client().test_site_url(), command=command)
        return Evidence(summary="site name is well formed", command=command)

    @check(DashboardStep.GetWorkbooks)
    def get_workbooks(self) -> Evidence:
        command = "fetch workbooks"
        call_endpoint(lambda: self._client().test_get_workbooks(), command=command)
        return Evidence(summary="workbooks are readable", command=command)

    @check(DashboardStep.GetViews)
    def get_views(self) -> Evidence:
        command = "fetch the views of a workbook"
        call_endpoint(lambda: self._client().test_get_workbook_views(), command=command)
        return Evidence(summary="workbook views are readable", command=command)

    @check(DashboardStep.GetOwners)
    def get_owners(self) -> Evidence:
        command = "fetch the owner of a workbook"
        call_endpoint(lambda: self._client().test_get_owners(), command=command)
        return Evidence(summary="workbook owners are resolvable", command=command)

    @check(DashboardStep.GetDataModels)
    def get_data_models(self) -> Evidence:
        command = "query the Metadata API for the data sources of a workbook"
        call_endpoint(lambda: self._client().test_get_datamodels(), command=command)
        return Evidence(summary="data sources are readable", command=command)


class TableauConnection(BaseConnection[TableauConnectionConfig, TableauClient]):
    def _get_client(self) -> TableauClient:
        return get_connection(self.service_connection)

    def checks(self) -> ChecksProvider:
        return TableauChecks(connection=self.service_connection)
