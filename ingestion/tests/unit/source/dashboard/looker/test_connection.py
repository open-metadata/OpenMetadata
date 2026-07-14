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
"""Unit tests for Looker test-connection checks."""

import socket
from unittest.mock import MagicMock, patch

import pytest
from looker_sdk.error import SDKError

from metadata.core.connections.test_connection.check import CheckError, collect_checks
from metadata.core.connections.test_connection.checks.dashboard import DashboardStep
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.dashboard.looker.connection import (
    LOOKER_ERRORS,
    LookerChecks,
    LookerConnection,
    LookerSettings,
    UnsupportedApiVersionError,
)

CONNECTION_MODULE = "metadata.ingestion.source.dashboard.looker.connection"

LOGIN_404 = "https://cloud.google.com/looker/docs/r/err/4.0/404/post/api/4.0/login"
DASHBOARDS_401 = "https://cloud.google.com/looker/docs/r/err/4.0/401/get/api/4.0/dashboards"
DASHBOARDS_403 = "https://cloud.google.com/looker/docs/r/err/4.0/403/get/api/4.0/dashboards"
DASHBOARDS_404 = "https://cloud.google.com/looker/docs/r/err/4.0/404/get/api/4.0/dashboards"


def _sdk_error(message: str, documentation_url: str = "") -> SDKError:
    """A Looker SDK error: it carries no status code, only a message and the
    documentation URL that encodes the status of the call that failed."""
    return SDKError(message, documentation_url=documentation_url)


def _versions(*supported: str) -> MagicMock:
    versions = MagicMock()
    versions.supported_versions = [MagicMock(version=version) for version in supported]

    return versions


def _checks() -> tuple[LookerChecks, MagicMock]:
    """A provider whose ``connect`` thunk hands back the returned mock SDK."""
    client = MagicMock()

    return LookerChecks(connect=lambda: client), client


def test_looker_connection_is_base_connection():
    assert issubclass(LookerConnection, BaseConnection)


def _config(host: str = "https://looker.example.com", client_id: str = "id", secret: str = "secret") -> MagicMock:
    config = MagicMock()
    config.hostPort = host
    config.clientId = client_id
    config.clientSecret.get_secret_value.return_value = secret

    return config


def test_get_client_initialises_the_sdk():
    with patch(f"{CONNECTION_MODULE}.looker_sdk") as mock_sdk:
        conn = LookerConnection(_config())
        client = conn.client

    assert client is mock_sdk.init40.return_value
    mock_sdk.init40.assert_called_once()


def test_the_sdk_is_configured_from_this_service_not_the_environment(monkeypatch):
    # The SDK reads its host and credentials from the environment by default, and a
    # long-lived worker only populates those once - so a second Looker connection in
    # the same process must not inherit the first one's host or credentials.
    monkeypatch.setenv("LOOKERSDK_BASE_URL", "https://first.example.com")
    monkeypatch.setenv("LOOKERSDK_CLIENT_ID", "first-id")
    monkeypatch.setenv("LOOKERSDK_CLIENT_SECRET", "first-secret")

    settings = LookerSettings(_config(host="https://second.example.com", client_id="second-id", secret="second-secret"))

    assert settings.base_url == "https://second.example.com"
    assert settings.read_config() == {
        "base_url": "https://second.example.com",
        "client_id": "second-id",
        "client_secret": "second-secret",
    }


def test_checks_run_against_the_client_the_connection_owns():
    # The provider holds no client of its own: it reads BaseConnection.client, so
    # every step shares the one client the connection builds, caches, and closes.
    with patch(f"{CONNECTION_MODULE}.looker_sdk") as mock_sdk:
        conn = LookerConnection(MagicMock())
        provider = conn.checks()
        provider.check_access()

    assert isinstance(provider, LookerChecks)
    mock_sdk.init40.return_value.me.assert_called_once_with()
    assert conn._client is mock_sdk.init40.return_value


def test_building_the_provider_does_not_build_the_client():
    # The SDK must not be built while the provider is assembled: that would run
    # before the runner's gate.
    with patch(f"{CONNECTION_MODULE}.looker_sdk") as mock_sdk:
        conn = LookerConnection(MagicMock())
        conn.checks()

    mock_sdk.init40.assert_not_called()


def test_the_client_is_built_once_and_shared_across_checks():
    with patch(f"{CONNECTION_MODULE}.looker_sdk") as mock_sdk:
        mock_sdk.init40.return_value.versions.return_value = _versions("4.0")
        conn = LookerConnection(MagicMock())
        provider = conn.checks()
        provider.check_access()
        provider.validate_version()

    mock_sdk.init40.assert_called_once()


def test_collect_checks_maps_every_step():
    provider, _ = _checks()
    collected = collect_checks(provider)

    assert set(collected) == {
        DashboardStep.CheckAccess,
        DashboardStep.ValidateVersion,
        DashboardStep.ListDashboards,
        DashboardStep.ListLookMLModels,
    }


def test_check_access_reads_the_authenticated_user():
    provider, client = _checks()

    evidence = provider.check_access()

    client.me.assert_called_once_with()
    assert evidence.summary == "authenticated"
    assert evidence.command == "log in and read the authenticated user"


def test_check_access_wraps_a_rejected_login_as_check_error():
    # The SDK logs in lazily on its first call, so bad credentials surface as a
    # classified CheckAccess failure instead of escaping while the provider is built.
    provider, client = _checks()
    client.me.side_effect = _sdk_error("Not found", documentation_url=LOGIN_404)

    with pytest.raises(CheckError) as exc_info:
        provider.check_access()

    assert isinstance(exc_info.value.cause, SDKError)
    assert exc_info.value.evidence.command == "log in and read the authenticated user"


def test_validate_version_passes_when_the_sdk_version_is_supported():
    provider, client = _checks()
    client.versions.return_value = _versions("3.1", "4.0")

    evidence = provider.validate_version()

    assert evidence.summary == "API 4.0 is supported"
    assert evidence.command == "list the API versions the instance supports"


def test_validate_version_fails_when_the_sdk_version_is_missing():
    provider, client = _checks()
    client.versions.return_value = _versions("3.1")

    with pytest.raises(CheckError) as exc_info:
        provider.validate_version()

    assert isinstance(exc_info.value.cause, UnsupportedApiVersionError)
    assert "3.1" in str(exc_info.value.cause)
    assert exc_info.value.evidence.command == "list the API versions the instance supports"


def test_list_dashboards_counts_what_it_enumerated():
    provider, client = _checks()
    client.all_dashboards.return_value = [MagicMock(), MagicMock()]

    evidence = provider.list_dashboards()

    client.all_dashboards.assert_called_once_with(fields="id,title")
    assert evidence.summary == "2 dashboards enumerated"
    assert evidence.caveat is None


def test_list_dashboards_warns_when_none_are_visible():
    provider, client = _checks()
    client.all_dashboards.return_value = []

    evidence = provider.list_dashboards()

    assert evidence.summary == "0 dashboards enumerated"
    assert evidence.caveat is not None
    assert evidence.caveat.title == "No dashboards visible"


def test_list_lookml_models_warns_when_none_are_visible():
    # Not mandatory: unreadable models cost lineage, not the connection.
    provider, client = _checks()
    client.all_lookml_models.return_value = []

    evidence = provider.list_lookml_models()

    client.all_lookml_models.assert_called_once_with(limit=1)
    assert evidence.caveat is not None
    assert evidence.caveat.title == "No LookML models visible"


def test_list_lookml_models_wraps_a_failure_as_check_error():
    provider, client = _checks()
    client.all_lookml_models.side_effect = _sdk_error("Insufficient permissions", documentation_url=DASHBOARDS_403)

    with pytest.raises(CheckError) as exc_info:
        provider.list_lookml_models()

    assert exc_info.value.evidence.command == "list LookML models"


def test_rejected_credentials_are_diagnosed_as_an_auth_failure():
    # Looker answers a wrong client id or secret with a 404 on /login, so the
    # endpoint - not the status - is what separates it from a wrong host.
    diagnosis = LOOKER_ERRORS.classify(_sdk_error("Not found", documentation_url=LOGIN_404))

    assert diagnosis is not None
    assert diagnosis.title == "Authentication failed"


def test_rejected_credentials_are_diagnosed_from_the_raw_login_body():
    # The real shape: a failed login raises the undeserialized response body as the
    # message, leaving documentation_url empty (only API calls populate it). The
    # doc URL is still in the text, which is what the status rules read.
    diagnosis = LOOKER_ERRORS.classify(_sdk_error('{"message": "Not found", "documentation_url": "' + LOGIN_404 + '"}'))

    assert diagnosis is not None
    assert diagnosis.title == "Authentication failed"


def test_a_404_away_from_login_is_diagnosed_as_a_missing_resource():
    diagnosis = LOOKER_ERRORS.classify(_sdk_error("Not found", documentation_url=DASHBOARDS_404))

    assert diagnosis is not None
    assert diagnosis.title == "Resource not found"


def test_a_401_is_diagnosed_as_an_auth_failure():
    diagnosis = LOOKER_ERRORS.classify(_sdk_error("Not authenticated", documentation_url=DASHBOARDS_401))

    assert diagnosis is not None
    assert diagnosis.title == "Authentication failed"


def test_a_403_is_diagnosed_as_missing_permissions():
    diagnosis = LOOKER_ERRORS.classify(_sdk_error("Insufficient permissions", documentation_url=DASHBOARDS_403))

    assert diagnosis is not None
    assert diagnosis.title == "Insufficient permissions"


def test_an_unavailable_instance_is_diagnosed():
    # Looker serves an HTML "Looker is unavailable" 404 when the hostname does not
    # reach a running instance - a Looker answer, but with no error document.
    diagnosis = LOOKER_ERRORS.classify(
        _sdk_error(
            "<html><head><title>Looker Not Found (404)</title></head><body><h1>Looker is unavailable.</h1></body></html>"
        )
    )

    assert diagnosis is not None
    assert diagnosis.title == "The Looker instance is unavailable"


def test_a_host_that_is_not_looker_is_diagnosed():
    # A non-Looker server answers the login POST with its own 404 body, which
    # carries no Looker error document - the shape a typo'd hostPort produces.
    diagnosis = LOOKER_ERRORS.classify(_sdk_error('{"code":404,"message":"HTTP 404 Not Found"}'))

    assert diagnosis is not None
    assert diagnosis.title == "The host is not serving the Looker API"


def test_a_looker_404_outranks_the_not_a_looker_host_fallback():
    # Ordering guard: a genuine Looker 404 carries a documentation URL, so it must
    # keep its sharper diagnosis rather than falling through to the text fallback.
    diagnosis = LOOKER_ERRORS.classify(_sdk_error("Not found", documentation_url=DASHBOARDS_404))

    assert diagnosis is not None
    assert diagnosis.title == "Resource not found"


def test_missing_credentials_are_diagnosed():
    diagnosis = LOOKER_ERRORS.classify(_sdk_error("Required auth credentials not found."))

    assert diagnosis is not None
    assert diagnosis.title == "Missing credentials"


def test_an_unsupported_api_version_is_diagnosed():
    diagnosis = LOOKER_ERRORS.classify(UnsupportedApiVersionError("API 4.0 is not listed"))

    assert diagnosis is not None
    assert diagnosis.title == "API 4.0 is not supported by this instance"


def test_a_dns_failure_is_diagnosed_from_the_flattened_message():
    # The SDK's transport catches every IOError and re-raises it as an SDKError
    # whose message is the stringified original, so the exception type is gone and
    # only the text can be matched.
    error = _sdk_error(
        "HTTPSConnectionPool(host='nope.cloud.looker.com', port=443): Max retries exceeded with "
        'url: /api/4.0/login (Caused by NameResolutionError("Failed to resolve '
        "'nope.cloud.looker.com' ([Errno 8] nodename nor servname provided, or not known)\"))"
    )

    diagnosis = LOOKER_ERRORS.classify(error)

    assert diagnosis is not None
    assert diagnosis.title == "Host could not be resolved"


def test_a_refused_connection_is_diagnosed_from_the_flattened_message():
    error = _sdk_error(
        "HTTPSConnectionPool(host='looker.example.com', port=19999): Max retries exceeded with "
        "url: /api/4.0/login (Caused by NewConnectionError('Connection refused'))"
    )

    diagnosis = LOOKER_ERRORS.classify(error)

    assert diagnosis is not None
    assert diagnosis.title == "Connection refused"


def test_a_tls_failure_is_diagnosed_from_the_flattened_message():
    error = _sdk_error(
        "HTTPSConnectionPool(host='looker.example.com', port=443): Max retries exceeded with url: "
        "/api/4.0/login (Caused by SSLError(SSLCertVerificationError(1, 'certificate verify "
        "failed: self signed certificate')))"
    )

    diagnosis = LOOKER_ERRORS.classify(error)

    assert diagnosis is not None
    assert diagnosis.title == "TLS verification failed"


def test_an_unreachable_host_is_diagnosed_from_the_flattened_message():
    error = _sdk_error(
        "HTTPSConnectionPool(host='looker.example.com', port=443): Max retries exceeded with url: "
        "/api/4.0/login (Caused by NewConnectionError('Network is unreachable'))"
    )

    diagnosis = LOOKER_ERRORS.classify(error)

    assert diagnosis is not None
    assert diagnosis.title == "Cannot reach the host"


def test_the_shared_network_pack_still_classifies_a_raw_socket_error():
    # Anything raised outside the SDK's transport keeps its type, so the folded
    # NETWORK_ERRORS rules remain the fallback.
    diagnosis = LOOKER_ERRORS.classify(socket.gaierror("nodename nor servname provided"))

    assert diagnosis is not None
    assert diagnosis.title == "Host could not be resolved"


def test_an_unknown_error_is_not_classified():
    assert LOOKER_ERRORS.classify(_sdk_error("something entirely new")) is None
