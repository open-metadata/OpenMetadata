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

from metadata.core.connections.test_connection.check import CheckError, collect_checks
from metadata.core.connections.test_connection.checks.dashboard import DashboardStep
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.source.dashboard.powerbi.connection import (
    POWERBI_ERRORS,
    PowerBIChecks,
    PowerBIConnection,
)

CONNECTION_MODULE = "metadata.ingestion.source.dashboard.powerbi.connection"


def _api_error(status_code: int) -> APIError:
    http_error = MagicMock()
    http_error.response.status_code = status_code
    return APIError({"message": "boom", "code": "x"}, http_error)


def _checks(get_connection) -> tuple[PowerBIChecks, MagicMock]:
    """A provider whose lazily-built REST client is the returned mock."""
    api_client = MagicMock()
    get_connection.return_value.api_client = api_client
    return PowerBIChecks(connection=MagicMock()), api_client


def test_powerbi_connection_is_base_connection():
    assert issubclass(PowerBIConnection, BaseConnection)


def test_get_client_delegates_to_get_connection():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        conn = PowerBIConnection(MagicMock())
        client = conn.client

    assert client is mock_get.return_value
    mock_get.assert_called_once_with(conn.service_connection)


def test_checks_does_not_touch_the_network():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        conn = PowerBIConnection(MagicMock())
        provider = conn.checks()

    assert isinstance(provider, PowerBIChecks)
    mock_get.assert_not_called()


def test_collect_checks_maps_every_step():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        provider, _ = _checks(mock_get)
    collected = collect_checks(provider)

    assert set(collected) == {DashboardStep.CheckAccess, DashboardStep.GetDashboards}


def test_check_access_authenticates():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        provider, client = _checks(mock_get)
        client.get_auth_token.return_value = ("token", "3600")

        evidence = provider.check_access()

    client.get_auth_token.assert_called_once_with()
    assert evidence.summary == "authenticated"
    assert evidence.command == "acquire OAuth token"


def test_check_access_wraps_failure_as_check_error():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        provider, client = _checks(mock_get)
        client.get_auth_token.side_effect = InvalidSourceException("no token")

        with pytest.raises(CheckError) as exc_info:
            provider.check_access()

    assert isinstance(exc_info.value.cause, InvalidSourceException)
    assert exc_info.value.evidence.command == "acquire OAuth token"


def test_get_dashboards_counts_results():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        provider, client = _checks(mock_get)
        client.fetch_dashboards.return_value = [object(), object(), object()]

        evidence = provider.get_dashboards()

    assert evidence.summary == "3 dashboards enumerated"
    assert evidence.command == "fetch dashboards"


def test_get_dashboards_caps_the_count():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        provider, client = _checks(mock_get)
        client.fetch_dashboards.return_value = [object()] * 250

        evidence = provider.get_dashboards()

    assert evidence.summary == "100+ dashboards enumerated"


def test_get_dashboards_empty_is_singular_aware():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        provider, client = _checks(mock_get)
        client.fetch_dashboards.return_value = None

        evidence = provider.get_dashboards()

    assert evidence.summary == "0 dashboards enumerated"


def test_get_dashboards_wraps_failure_as_check_error():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        provider, client = _checks(mock_get)
        client.fetch_dashboards.side_effect = _api_error(403)

        with pytest.raises(CheckError) as exc_info:
            provider.get_dashboards()

    assert exc_info.value.evidence.command == "fetch dashboards"


@pytest.mark.parametrize(
    ("error", "title"),
    [
        (_api_error(401), "Authentication failed"),
        (InvalidSourceException("bad creds"), "Authentication failed"),
        (_api_error(403), "Insufficient permissions"),
        (_api_error(404), "Resource not found"),
        (ValueError("Unable to get authority configuration for https://login..."), "Invalid tenant or authority"),
        (ValueError("invalid_instance: The authority you provided is not known"), "Invalid tenant or authority"),
        (socket.gaierror("name resolution failed"), "Host could not be resolved"),
    ],
)
def test_error_pack_classifies(error, title):
    diagnosis = POWERBI_ERRORS.classify(error)

    assert diagnosis is not None
    assert diagnosis.title == title


def test_error_pack_ignores_unknown_error():
    assert POWERBI_ERRORS.classify(ValueError("something else")) is None
