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
from typing import ClassVar
from unittest.mock import MagicMock, patch

import pytest
from looker_sdk.error import SDKError
from looker_sdk.rtl.requests_transport import RequestsTransport
from looker_sdk.rtl.transport import HttpMethod

from metadata.core.connections.lifetime import Borrowed
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
from metadata.utils.constants import THREE_MIN

CONNECTION_MODULE = "metadata.ingestion.source.dashboard.looker.connection"

LOGIN_404 = "https://cloud.google.com/looker/docs/r/err/4.0/404/post/api/4.0/login"
DASHBOARDS_404 = "https://cloud.google.com/looker/docs/r/err/4.0/404/get/api/4.0/dashboards"
DASHBOARDS_429 = "https://cloud.google.com/looker/docs/r/err/4.0/429/get/api/4.0/dashboards"
DASHBOARDS_400 = "https://cloud.google.com/looker/docs/r/err/4.0/400/get/api/4.0/dashboards"
DASHBOARDS_401 = "https://cloud.google.com/looker/docs/r/err/4.0/401/get/api/4.0/dashboards"
DASHBOARDS_403 = "https://cloud.google.com/looker/docs/r/err/4.0/403/get/api/4.0/dashboards"


class _TransportSettings:
    """The transport's settings contract, as looker_sdk.rtl.transport defines it.

    Duck-typed rather than mocked: RequestsTransport reads these attributes at
    configure() time, and a MagicMock would silently satisfy any shape.
    """

    base_url = "https://looker.example.com:19999"
    verify_ssl = True
    timeout = 10
    agent_tag = "test"
    headers: ClassVar[dict] = {}


def _sdk_error(message: str, documentation_url: str = "") -> SDKError:
    """A Looker SDK error: it carries no status code, only a message and the
    documentation URL that encodes the status of the call that failed."""
    return SDKError(message, documentation_url=documentation_url)


def _versions(*supported: str) -> MagicMock:
    versions = MagicMock()
    versions.supported_versions = [MagicMock(version=version) for version in supported]

    return versions


def _checks() -> tuple[LookerChecks, MagicMock]:
    """A provider over a borrowed client - the one its connection owns."""
    client = MagicMock()

    return LookerChecks(looker=Borrowed.of(client)), client


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
    # A long-lived worker populates the SDK's env vars once, so a second connection
    # in the same process must not inherit the first one's host or credentials.
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
    # The provider borrows the client its connection owns, so every step shares the
    # one the connection builds, caches, and closes.
    with patch(f"{CONNECTION_MODULE}.looker_sdk") as mock_sdk:
        conn = LookerConnection(MagicMock())
        provider = conn.checks()
        provider.check_access()

    assert isinstance(provider, LookerChecks)
    mock_sdk.init40.return_value.me.assert_called_once_with()
    assert conn._client is mock_sdk.init40.return_value


def test_building_the_provider_does_not_build_the_client():
    # Building it while the provider is assembled would run before the gate.
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
    # The SDK logs in on its first call, so bad credentials fail the gate rather
    # than escaping while the provider is built.
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

    assert evidence.summary == "no dashboards enumerated"
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
    client.all_lookml_models.side_effect = _sdk_error("Not found", documentation_url=DASHBOARDS_404)

    with pytest.raises(CheckError) as exc_info:
        provider.list_lookml_models()

    assert exc_info.value.evidence.command == "list LookML models"


def test_rejected_credentials_are_diagnosed_as_an_auth_failure():
    # A rejected login is a 404 on /login: the endpoint, not the status, tells it
    # apart from a wrong host.
    diagnosis = LOOKER_ERRORS.classify(_sdk_error("Not found", documentation_url=LOGIN_404))

    assert diagnosis is not None
    assert diagnosis.title == "Authentication failed"


def test_rejected_credentials_are_diagnosed_from_the_raw_login_body():
    # A failed login raises the raw body as the message and leaves
    # documentation_url empty; the URL is still in the text the rules read.
    diagnosis = LOOKER_ERRORS.classify(_sdk_error('{"message": "Not found", "documentation_url": "' + LOGIN_404 + '"}'))

    assert diagnosis is not None
    assert diagnosis.title == "Authentication failed"


def test_rejected_credentials_are_diagnosed_when_str_omits_the_doc_url():
    # looker-sdk only renders documentation_url in __str__ from 24.x on; on the
    # oldest supported version (22.20.0) it lives on the attribute alone.
    class OldSdkError(Exception):
        documentation_url = LOGIN_404

    diagnosis = LOOKER_ERRORS.classify(OldSdkError("Not found"))

    assert diagnosis is not None
    assert diagnosis.title == "Authentication failed"


def test_a_network_error_carrying_an_incidental_404_stays_a_network_error():
    # "404" inside a port must not read as an HTTP 404 from a non-Looker host.
    error = _sdk_error(
        "HTTPConnectionPool(host='looker.example.com', port=8404): Max retries exceeded with url: "
        "/api/4.0/login (Caused by NewConnectionError('Connection refused'))"
    )

    diagnosis = LOOKER_ERRORS.classify(error)

    assert diagnosis is not None
    assert diagnosis.title == "Connection refused"


def test_a_404_away_from_login_is_diagnosed_as_a_missing_resource():
    diagnosis = LOOKER_ERRORS.classify(_sdk_error("Not found", documentation_url=DASHBOARDS_404))

    assert diagnosis is not None
    assert diagnosis.title == "Resource not found"


def test_a_429_is_diagnosed_as_rate_limiting():
    diagnosis = LOOKER_ERRORS.classify(_sdk_error("Too many requests", documentation_url=DASHBOARDS_429))

    assert diagnosis is not None
    assert diagnosis.title == "Rate limited by Looker"


def test_an_undocumented_status_keeps_its_raw_error():
    # The API spec has no 401 anywhere and no 403 on the endpoints these checks
    # call, so neither gets an invented diagnosis.
    assert LOOKER_ERRORS.classify(_sdk_error("nope", documentation_url=DASHBOARDS_401)) is None
    assert LOOKER_ERRORS.classify(_sdk_error("nope", documentation_url=DASHBOARDS_403)) is None


def test_lookers_generic_404_page_is_diagnosed_as_an_auth_failure():
    # What a live Looker returns for a rejected sign-in - and for a host that is not
    # a live instance, so the two cannot be told apart.
    diagnosis = LOOKER_ERRORS.classify(
        _sdk_error(
            "<html><head><title>Looker Not Found (404)</title></head><body><h1>Looker is unavailable.</h1></body></html>"
        )
    )

    assert diagnosis is not None
    assert diagnosis.title == "Authentication failed"


def test_a_host_that_is_not_looker_is_diagnosed():
    # A non-Looker server answers with its own 404 body, carrying no Looker error
    # document.
    diagnosis = LOOKER_ERRORS.classify(_sdk_error('{"code":404,"message":"HTTP 404 Not Found"}'))

    assert diagnosis is not None
    assert diagnosis.title == "The host is not serving the Looker API"


def test_a_looker_error_with_an_undiagnosed_status_keeps_its_raw_error():
    # A Looker 400 whose message reads "parameter not found" must not be blamed on
    # Host Port: it carries an error document, so it is a Looker answer.
    diagnosis = LOOKER_ERRORS.classify(_sdk_error("parameter not found", documentation_url=DASHBOARDS_400))

    assert diagnosis is None


def test_a_looker_error_whose_message_mentions_a_transport_word_keeps_its_raw_error():
    # A structured Looker error (carries a doc) whose text happens to contain a
    # transport token must not be read as a network failure.
    diagnosis = LOOKER_ERRORS.classify(_sdk_error("Query exceeded the timeout", documentation_url=DASHBOARDS_400))

    assert diagnosis is None


def test_the_step_timeout_keeps_the_legacy_three_minute_budget():
    # Listing dashboards and LookML models can be slow on large instances.
    assert LookerConnection.step_timeout_seconds == THREE_MIN


def test_a_looker_404_outranks_the_not_a_looker_host_fallback():
    # Ordering guard: a genuine Looker 404 carries a documentation URL and must keep
    # the sharper diagnosis.
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


@pytest.mark.parametrize(
    ("raised", "title"),
    [
        (ConnectionRefusedError(61, "Connection refused"), "Connection refused"),
        (socket.gaierror(8, "nodename nor servname provided"), "Host could not be resolved"),
        (TimeoutError("timed out"), "Connection timed out"),
    ],
)
def test_a_socket_error_is_flattened_by_the_sdk_and_diagnosed_from_its_text(raised, title):
    """Drives the real transport: the type is destroyed, the text still diagnoses.

    This is why NETWORK_ERRORS (which matches by type) is not folded into the pack.
    """
    transport_ = RequestsTransport.configure(_TransportSettings())

    with patch.object(transport_.session, "request", side_effect=raised):
        response = transport_.request(HttpMethod.GET, "/api/4.0/user")

    assert response.ok is False
    assert isinstance(response.value, bytes)

    # What the SDK hands the classifier: the flattened text, not the exception.
    flattened = _sdk_error(response.value.decode())
    assert LOOKER_ERRORS.classify(flattened).title == title


@pytest.mark.parametrize(
    ("raised", "title"),
    [
        (ConnectionRefusedError(61, "Connection refused"), "Connection refused"),
        (socket.gaierror(8, "nodename nor servname provided"), "Host could not be resolved"),
        (TimeoutError("timed out"), "Connection timed out"),
    ],
)
def test_dropping_the_network_fold_changes_no_diagnosis(raised, title):
    """_transport_text returns the same titles NETWORK_ERRORS would, so dropping the
    fold is behaviour-preserving even where it could have been reached."""
    assert LOOKER_ERRORS.classify(raised).title == title


def test_an_unknown_error_is_not_classified():
    assert LOOKER_ERRORS.classify(_sdk_error("something entirely new")) is None
