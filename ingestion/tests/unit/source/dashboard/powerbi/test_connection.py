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
"""Unit tests for Power BI test-connection checks."""

import socket
from unittest.mock import MagicMock, patch

import pytest
from requests.exceptions import HTTPError

from metadata.core.connections.lifetime import Borrowed
from metadata.core.connections.test_connection.check import CheckError, collect_checks
from metadata.core.connections.test_connection.checks.dashboard import DashboardStep
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.source.dashboard.powerbi.client import PowerBiApiClient
from metadata.ingestion.source.dashboard.powerbi.connection import (
    POWERBI_ERRORS,
    PowerBIChecks,
    PowerBIConnection,
)

CONNECTION_MODULE = "metadata.ingestion.source.dashboard.powerbi.connection"


def _api_error(status_code: int, message: str = "boom") -> APIError:
    http_error = MagicMock()
    http_error.response.status_code = status_code
    return APIError({"message": message, "code": "x"}, http_error)


def _raw_http_error(status_code: int) -> HTTPError:
    """A bare requests.HTTPError as the client re-raises when the body has no
    'code' field - status lives on .response.status_code, not .status_code."""
    response = MagicMock()
    response.status_code = status_code
    return HTTPError("server said no", response=response)


def _checks() -> tuple[PowerBIChecks, MagicMock]:
    """A provider over a borrowed client - the one its connection owns."""
    api_client = MagicMock()
    powerbi_client = MagicMock(api_client=api_client)
    return PowerBIChecks(powerbi=Borrowed.of(powerbi_client)), api_client


def test_powerbi_connection_is_base_connection():
    assert issubclass(PowerBIConnection, BaseConnection)


def test_checks_does_not_touch_the_network():
    with patch(f"{CONNECTION_MODULE}.PowerBiApiClient") as mock_client:
        conn = PowerBIConnection(MagicMock())
        provider = conn.checks()

    assert isinstance(provider, PowerBIChecks)
    mock_client.assert_not_called()


def test_checks_reuse_the_connections_client_and_never_authenticate_twice():
    # The provider borrows the client its connection owns, so the checks and the
    # ingestion share one authenticated session instead of acquiring a second token.
    with patch(f"{CONNECTION_MODULE}.PowerBiApiClient") as mock_client:
        # PowerBiClient validates its api_client field, so the fake must carry the spec.
        mock_client.return_value = MagicMock(spec=PowerBiApiClient)
        conn = PowerBIConnection(MagicMock(pbitFilesSource=None))
        provider = conn.checks()

        provider.check_access()
        provider.get_dashboards()

    assert mock_client.call_count == 1


def test_collect_checks_maps_every_step():
    provider, _ = _checks()
    collected = collect_checks(provider)

    assert set(collected) == {DashboardStep.CheckAccess, DashboardStep.GetDashboards}


def test_check_access_authenticates():
    provider, client = _checks()
    client.get_auth_token.return_value = ("token", "3600")

    evidence = provider.check_access()

    client.get_auth_token.assert_called_once_with()
    assert evidence.summary == "authenticated"
    assert evidence.command == "acquire OAuth token"


def test_check_access_wraps_failure_as_check_error():
    provider, client = _checks()
    client.get_auth_token.side_effect = InvalidSourceException("no token")

    with pytest.raises(CheckError) as exc_info:
        provider.check_access()

    assert isinstance(exc_info.value.cause, InvalidSourceException)
    assert exc_info.value.evidence.command == "acquire OAuth token"


def test_get_dashboards_counts_results():
    provider, client = _checks()
    client.fetch_dashboards.return_value = [object(), object(), object()]

    evidence = provider.get_dashboards()

    assert evidence.summary == "3 dashboards enumerated"
    assert evidence.command == "fetch dashboards"


def test_get_dashboards_caps_the_count():
    provider, client = _checks()
    client.fetch_dashboards.return_value = [object()] * 250

    evidence = provider.get_dashboards()

    assert evidence.summary == "100+ dashboards enumerated"
    assert evidence.caveat is None


def test_get_dashboards_at_cap_shows_plus():
    provider, client = _checks()
    client.fetch_dashboards.return_value = [object()] * 100

    evidence = provider.get_dashboards()

    assert evidence.summary == "100+ dashboards enumerated"


def test_get_dashboards_empty_passes_with_caveat():
    provider, client = _checks()
    client.fetch_dashboards.return_value = None

    evidence = provider.get_dashboards()

    assert evidence.summary == "0 dashboards enumerated"
    assert evidence.caveat is not None
    assert evidence.caveat.title == "No dashboards visible"


def test_get_dashboards_wraps_failure_as_check_error():
    provider, client = _checks()
    client.fetch_dashboards.side_effect = _api_error(403)

    with pytest.raises(CheckError) as exc_info:
        provider.get_dashboards()

    assert exc_info.value.evidence.command == "fetch dashboards"


def test_get_dashboards_wraps_client_build_failure():
    # Reading the borrow is what builds the client (MSAL discovery), and that read
    # happens inside fetch_list's try, so a build failure still reports the step's
    # command rather than escaping raw.
    provider = PowerBIChecks(powerbi=Borrowed(MagicMock(side_effect=ValueError("authority discovery failed"))))

    with pytest.raises(CheckError) as exc_info:
        provider.get_dashboards()

    assert exc_info.value.evidence.command == "fetch dashboards"
    assert isinstance(exc_info.value.cause, ValueError)


@pytest.mark.parametrize(
    ("error", "title"),
    [
        (_api_error(401), "Power BI did not authorize the service principal"),
        (InvalidSourceException("bad creds"), "Authentication failed"),
        (_api_error(403), "Insufficient permissions"),
        (_api_error(404), "Resource not found"),
        (_raw_http_error(401), "Power BI did not authorize the service principal"),
        (_raw_http_error(403), "Insufficient permissions"),
        (_raw_http_error(404), "Resource not found"),
        # A status-coded 401 whose message echoes the authority URL must classify
        # by its status, not be shadowed by the broad 'authority' matcher.
        (
            _api_error(401, "AADSTS700016 https://login.microsoftonline.com/<tenant> authority"),
            "Power BI did not authorize the service principal",
        ),
        (ValueError("Unable to get authority configuration for https://login..."), "Invalid tenant or authority"),
        (ValueError("invalid_instance: The authority you provided is not known"), "Invalid tenant or authority"),
        (
            ValueError("Your given address (https://login...) should consist of an https url"),
            "Invalid tenant or authority",
        ),
        (socket.gaierror("name resolution failed"), "Host could not be resolved"),
    ],
)
def test_error_pack_classifies(error, title):
    diagnosis = POWERBI_ERRORS.classify(error)

    assert diagnosis is not None
    assert diagnosis.title == title


def test_error_pack_ignores_unknown_error():
    assert POWERBI_ERRORS.classify(ValueError("something else")) is None
