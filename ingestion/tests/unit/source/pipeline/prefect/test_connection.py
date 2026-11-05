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
"""Unit tests for Prefect connection handling and its test-connection checks."""

import socket
from unittest.mock import MagicMock, patch

import pytest
from requests.exceptions import ConnectionError as RequestsConnectionError
from requests.exceptions import HTTPError, ReadTimeout, SSLError

from metadata.core.connections.lifetime import Borrowed
from metadata.core.connections.test_connection import collect_checks
from metadata.core.connections.test_connection.check import CheckError
from metadata.core.connections.test_connection.checks.pipeline import PipelineStep
from metadata.core.connections.test_connection.classifier import exception_chain
from metadata.core.connections.test_connection.network import NetworkUnreachableError
from metadata.generated.schema.entity.services.connections.pipeline.prefect.cloudAuth import (
    PrefectCloudAuthentication,
)
from metadata.generated.schema.entity.services.connections.pipeline.prefect.serverAuth import (
    PrefectServerAuthentication,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.pipeline.prefect.connection import (
    CLOUD_ERRORS,
    SERVER_ERRORS,
    PrefectChecks,
    PrefectConnection,
)

CONNECTION_MODULE = "metadata.ingestion.source.pipeline.prefect.connection"


def _http_error(status_code: int) -> HTTPError:
    return HTTPError(f"{status_code} error", response=MagicMock(status_code=status_code))


@pytest.fixture
def client():
    mock_client = MagicMock()
    mock_client.config.authType = PrefectServerAuthentication()
    return mock_client


@pytest.fixture
def checks(client):
    return PrefectChecks(prefect=Borrowed.of(client))


def test_prefect_connection_is_base_connection():
    assert issubclass(PrefectConnection, BaseConnection)


def test_get_client_builds_the_client():
    with patch(f"{CONNECTION_MODULE}.PrefectClient") as mock_builder:
        conn = PrefectConnection(MagicMock())
        built = conn.client

    assert built is mock_builder.return_value
    mock_builder.assert_called_once_with(conn.service_connection)


def test_checks_expose_every_step():
    with patch(f"{CONNECTION_MODULE}.PrefectClient"):
        resolved = collect_checks(PrefectConnection(MagicMock()).checks())

    assert set(resolved) == {PipelineStep.CheckAccess, PipelineStep.GetPipelines}


def test_checks_borrow_the_connection_client():
    """The provider borrows the client BaseConnection owns, rather than opening a
    second one behind its back."""
    with patch(f"{CONNECTION_MODULE}.PrefectClient") as mock_builder:
        conn = PrefectConnection(MagicMock())
        provider = conn.checks()

        assert provider._prefect.client is conn.client
        mock_builder.assert_called_once()


def test_check_access_proves_the_workspace_is_readable(checks, client):
    evidence = checks.check_access()

    client.test_check_access.assert_called_once_with()
    assert evidence.summary == "authenticated"
    assert evidence.command == "read one flow of the configured workspace"


def test_get_pipelines_counts_the_flows(checks, client):
    client.test_get_flows.return_value = [MagicMock(), MagicMock()]

    evidence = checks.get_pipelines()

    assert evidence.summary == "2 flows enumerated"
    assert evidence.caveat is None


def test_get_pipelines_caveats_a_workspace_with_no_flows(checks, client):
    client.test_get_flows.return_value = []

    evidence = checks.get_pipelines()

    assert evidence.summary == "no flows enumerated"
    assert evidence.caveat is not None
    assert evidence.caveat.title == "No flows visible"


def test_a_failed_check_still_reports_what_it_ran(checks, client):
    client.test_get_flows.side_effect = _http_error(403)

    with pytest.raises(CheckError) as failure:
        checks.get_pipelines()

    assert failure.value.evidence.command == "fetch the flows of the workspace"
    assert failure.value.cause is client.test_get_flows.side_effect


@pytest.mark.parametrize("pack", [CLOUD_ERRORS, SERVER_ERRORS])
@pytest.mark.parametrize(
    ("error", "title"),
    [
        (_http_error(401), "Authentication failed"),
        (_http_error(403), "Access denied"),
        (_http_error(404), "Endpoint not found"),
        (_http_error(429), "Rate limited"),
        (SSLError("certificate verify failed"), "TLS verification failed"),
        (ReadTimeout("timed out"), "Connection timed out"),
        (RequestsConnectionError("name resolution failed"), "Cannot reach the host"),
    ],
)
def test_error_pack_diagnoses_known_failures(error, title, pack):
    diagnosis = pack.classify(error)

    assert diagnosis is not None
    assert diagnosis.title == title
    assert diagnosis.remediation


@pytest.mark.parametrize("status", [401, 403, 404])
def test_cloud_errors_mention_cloud_only_concepts(status):
    """Cloud has an API key and Account/Workspace ids; the fix text should say so."""
    remediation = CLOUD_ERRORS.classify(_http_error(status)).remediation

    assert "API key" in remediation or "Account Id" in remediation


@pytest.mark.parametrize("status", [401, 403, 404])
def test_server_errors_never_mention_cloud_only_concepts(status):
    """Self-hosted Server has no API key and no Account/Workspace id - telling a
    Server user to check those would send them chasing fields that don't exist."""
    remediation = SERVER_ERRORS.classify(_http_error(status)).remediation

    assert "API key" not in remediation
    assert "Account Id" not in remediation


@pytest.mark.parametrize("status", [401, 403])
def test_server_auth_errors_point_at_the_basic_auth_string(status):
    """401/403 are credential problems for Server - the fix should name the one
    credential Server actually has."""
    remediation = SERVER_ERRORS.classify(_http_error(status)).remediation

    assert "Basic Auth String" in remediation


def test_checks_use_cloud_errors_for_cloud_auth(client):
    client.config.authType = PrefectCloudAuthentication(apiKey="key", accountId="acct", workspaceId="ws")

    checks = PrefectChecks(prefect=Borrowed.of(client))

    assert checks.errors is CLOUD_ERRORS


def test_checks_use_server_errors_for_server_auth(client):
    client.config.authType = PrefectServerAuthentication()

    checks = PrefectChecks(prefect=Borrowed.of(client))

    assert checks.errors is SERVER_ERRORS


def _dns_failure() -> RequestsConnectionError:
    """A requests DNS failure, with the cause chain requests really builds.

    Captured live from `requests.get("https://<unresolvable>/", timeout=5)`, whose
    chain is ConnectionError <- MaxRetryError <- NameResolutionError <- gaierror.
    Reproduced here rather than dialling a resolver, so the test cannot flake on
    CI DNS - the shape is what matters, and the shape is the one observed.
    """
    error = RequestsConnectionError(
        "HTTPSConnectionPool(host='nope.invalid', port=443): Max retries exceeded with url: "
        "/api/flows/filter (Caused by NameResolutionError(\"Failed to resolve 'nope.invalid'\"))"
    )
    error.__cause__ = socket.gaierror(8, "nodename nor servname provided, or not known")
    return error


def test_a_dns_failure_is_claimed_by_the_connectors_own_rule():
    """The common pack (shared by both auth modes) walks the cause chain -
    checked once against CLOUD_ERRORS, since SERVER_ERRORS includes the same
    common rules via `.including()`."""
    error = _dns_failure()

    assert any(isinstance(current, socket.gaierror) for current in exception_chain(error))
    assert CLOUD_ERRORS.classify(error).title == "Cannot reach the host"


def test_network_unreachable_is_impossible_without_a_preflight():
    """This connector runs no TCP preflight, so the pack does not claim to
    diagnose a NetworkUnreachableError — nothing in it ever raises one."""
    assert CLOUD_ERRORS.classify(NetworkUnreachableError("api.prefect.cloud:443 is not reachable")) is None


def test_error_pack_diagnoses_a_status_wrapped_by_a_check_error():
    """The runner classifies the cause of a CheckError, but a connector error can
    also surface wrapped; the matcher walks the chain either way."""
    cause = _http_error(401)
    wrapped = RuntimeError("step failed")
    wrapped.__cause__ = cause

    assert CLOUD_ERRORS.classify(wrapped).title == "Authentication failed"


def test_error_pack_leaves_an_unknown_error_unclassified():
    assert CLOUD_ERRORS.classify(ValueError("something else")) is None
