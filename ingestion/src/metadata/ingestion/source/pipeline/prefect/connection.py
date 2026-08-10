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

from requests.exceptions import ConnectionError as RequestsConnectionError
from requests.exceptions import SSLError, Timeout

from metadata.core.connections.test_connection import (
    Diagnosis,
    ErrorPack,
    Evidence,
    Matchers,
    check,
    when,
)
from metadata.core.connections.test_connection.checks.pipeline import PipelineStep
from metadata.core.connections.test_connection.checks.rest import (
    fetch_list,
    http_status,
    verify_access,
)
from metadata.generated.schema.entity.services.connections.pipeline.prefect.cloudAuth import (
    PrefectCloudAuthentication,
)
from metadata.generated.schema.entity.services.connections.pipeline.prefectConnection import (
    PrefectConnection as PrefectConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.pipeline.prefect.client import PrefectClient

if TYPE_CHECKING:
    from metadata.core.connections.lifetime import Borrowed
    from metadata.core.connections.test_connection import ChecksProvider

API_KEYS_DOC = "https://docs.prefect.io/v3/how-to-guides/cloud/manage-users/api-keys"

IDS_FIX = (
    "Check the Account Id and Workspace Id - both are in the workspace URL: "
    "app.prefect.cloud/account/<accountId>/workspace/<workspaceId>."
)

NO_FLOWS_CAVEAT = Diagnosis(
    title="No flows visible",
    remediation="The workspace is readable but has no flow. Ingestion reads "
    "pipelines from Prefect flows, so it would find nothing.",
)

# Auth-agnostic: same wording regardless of Cloud vs self-hosted Server.
_COMMON_ERRORS = ErrorPack(
    when(http_status(429)).diagnose(
        "Rate limited",
        fix="Prefect rate limited the request. Retry in a few minutes.",
    ),
    when(Matchers.exception(SSLError)).diagnose(
        "TLS verification failed",
        fix="The host's certificate could not be verified. Check the SSL "
        "configuration and that any TLS-intercepting proxy is trusted where "
        "ingestion runs.",
    ),
    when(Matchers.exception(Timeout)).diagnose(
        "Connection timed out",
        fix="Prefect did not answer in time. Check that a firewall or network "
        "ACL allows egress to Host and Port from where ingestion runs.",
    ),
    when(Matchers.exception(RequestsConnectionError)).diagnose(
        "Cannot reach the host",
        fix="Check Host and Port for typos and that it resolves from where ingestion runs.",
    ),
)

# Cloud has an API key plus Account/Workspace ids; self-hosted Server has neither,
# so 401/403/404 need their own wording per auth mode - the rest is shared.
CLOUD_ERRORS = ErrorPack(
    when(http_status(401)).diagnose(
        "Authentication failed",
        fix="Prefect rejected the API key. Check it is a valid, unexpired key.",
        doc=API_KEYS_DOC,
    ),
    when(http_status(403)).diagnose(
        "Access denied",
        fix=f"Prefect refused the request. {IDS_FIX} If both are right, check "
        "the API key belongs to that account and can read the workspace.",
        doc=API_KEYS_DOC,
    ),
    when(http_status(404)).diagnose(
        "Endpoint not found",
        fix=f"Host, Account Id and Workspace Id build the path the API answered 404 for. {IDS_FIX}",
    ),
).including(_COMMON_ERRORS)

SERVER_ERRORS = ErrorPack(
    when(http_status(401)).diagnose(
        "Authentication failed",
        fix="Prefect rejected the credentials. Check the Basic Auth String "
        "(PREFECT_SERVER_API_AUTH_STRING, format 'user:password') is correct, "
        "or that the server truly has no auth enabled.",
    ),
    when(http_status(403)).diagnose(
        "Access denied",
        fix="Prefect refused the request. Check the Basic Auth String is "
        "correct and has read access to this workspace.",
    ),
    when(http_status(404)).diagnose(
        "Endpoint not found",
        fix="Host and Port build the path the API answered 404 for. Check for "
        "typos and that this is the Prefect API base URL, not the UI URL.",
    ),
).including(_COMMON_ERRORS)


class PrefectChecks:
    """Test-connection checks for Prefect.

    ``CheckAccess`` is the gate: it reads one flow, which proves the host, the
    API key and - on Prefect Cloud - the account and workspace ids at once, so
    the later steps are skipped rather than each re-dialling the API. The
    client is borrowed from the connection that owns it.
    """

    def __init__(self, prefect: Borrowed[PrefectClient]) -> None:
        self._prefect = prefect
        self.errors = (
            CLOUD_ERRORS if isinstance(prefect.client.config.authType, PrefectCloudAuthentication) else SERVER_ERRORS
        )

    @check(PipelineStep.CheckAccess)
    def check_access(self) -> Evidence:
        return verify_access(
            lambda: self._prefect.client.test_check_access(),  # noqa: PLW0108
            command="read one flow of the configured workspace",
        )

    @check(PipelineStep.GetPipelines)
    def get_pipelines(self) -> Evidence:
        return fetch_list(
            lambda: self._prefect.client.test_get_flows(),  # noqa: PLW0108
            noun="flow",
            command="fetch the flows of the workspace",
            empty_caveat=NO_FLOWS_CAVEAT,
        )


class PrefectConnection(BaseConnection[PrefectConnectionConfig, PrefectClient]):
    def _get_client(self) -> PrefectClient:
        return PrefectClient(self.service_connection)

    def checks(self) -> ChecksProvider:
        return PrefectChecks(prefect=self.borrow())
