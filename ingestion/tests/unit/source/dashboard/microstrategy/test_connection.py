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
"""Unit tests for MicroStrategy connection handling."""

import socket
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import requests
from requests.exceptions import SSLError

from metadata.core.connections.lifetime import Borrowed
from metadata.core.connections.test_connection.check import CheckError, collect_checks
from metadata.core.connections.test_connection.checks.dashboard import DashboardStep
from metadata.generated.schema.entity.services.connections.dashboard.microStrategyConnection import (
    MicroStrategyConnection as MicroStrategyConnectionConfig,
)
from metadata.generated.schema.security.ssl.verifySSLConfig import VerifySSL
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.dashboard.microstrategy.client import MicroStrategyApiError
from metadata.ingestion.source.dashboard.microstrategy.connection import (
    MICROSTRATEGY_ERRORS,
    MicroStrategyChecks,
    MicroStrategyConnection,
    resolve_ssl,
)
from metadata.ingestion.source.dashboard.microstrategy.models import MstrProject, MstrSearchResult

CONNECTION_MODULE = "metadata.ingestion.source.dashboard.microstrategy.connection"


def _config(**overrides) -> MicroStrategyConnectionConfig:
    return MicroStrategyConnectionConfig(hostPort="https://mstr.example.com", username="u", password="p", **overrides)


def _checks(client: MagicMock) -> MicroStrategyChecks:
    return MicroStrategyChecks(client=Borrowed.of(client))


def _http_error(status: int) -> requests.HTTPError:
    response = requests.Response()
    response.status_code = status
    return requests.HTTPError("refused", response=response)


def test_microstrategy_connection_is_base_connection():
    assert issubclass(MicroStrategyConnection, BaseConnection)


def test_collect_checks_maps_every_definition_step():
    assert set(collect_checks(_checks(MagicMock()))) == {
        DashboardStep.GetToken,
        DashboardStep.GetProjects,
        DashboardStep.GetDashboards,
    }


def test_get_projects_fails_when_the_listing_fails():
    # The legacy step returned [] on any error, so a broken listing passed the test.
    client = MagicMock()
    client.get_projects_list.side_effect = MicroStrategyApiError("GET /projects failed")
    provider = _checks(client)

    with pytest.raises(CheckError):
        provider.get_projects()


def test_get_projects_counts_the_projects():
    client = MagicMock()
    client.get_projects_list.return_value = [MstrProject(id="P1", name="One"), MstrProject(id="P2", name="Two")]

    assert _checks(client).get_projects().summary.startswith("2")


def test_get_dashboards_reads_one_dossier_of_the_first_project():
    client = MagicMock()
    client.get_projects_list.return_value = [MstrProject(id="P1", name="One")]
    client.iter_search_results.return_value = iter([MstrSearchResult(id="D1", name="Dossier")])

    _checks(client).get_dashboards()

    client.iter_search_results.assert_called_once_with("P1", page_size=1)


def test_get_token_wraps_a_failed_login():
    login_error = MicroStrategyApiError("Login failed with HTTP 401")
    login_error.__cause__ = _http_error(401)
    provider = MicroStrategyChecks(client=Borrowed(MagicMock(side_effect=login_error)))

    with pytest.raises(CheckError) as exc_info:
        provider.get_token()

    diagnosis = MICROSTRATEGY_ERRORS.classify(exc_info.value)
    assert diagnosis is not None
    assert diagnosis.title == "Authentication failed"


def test_a_server_error_at_login_is_diagnosed():
    login_error = MicroStrategyApiError("Login failed with HTTP 500")
    login_error.__cause__ = _http_error(500)

    diagnosis = MICROSTRATEGY_ERRORS.classify(login_error)

    assert diagnosis is not None
    assert diagnosis.title == "MicroStrategy server error"


def test_an_unresolvable_host_is_diagnosed():
    error = requests.ConnectionError("Failed to resolve 'mstr.internal'")
    error.__cause__ = socket.gaierror(-2, "Name or service not known")

    assert MICROSTRATEGY_ERRORS.classify(error) is not None


@pytest.mark.parametrize(
    ("error", "title"),
    [
        (_http_error(403), "Insufficient permissions"),
        (_http_error(404), "MicroStrategy Library API not found"),
        (_http_error(500), "MicroStrategy server error"),
        (SSLError("certificate verify failed"), "TLS verification failed"),
    ],
)
def test_errors_are_diagnosed(error, title):
    diagnosis = MICROSTRATEGY_ERRORS.classify(error)
    assert diagnosis is not None
    assert diagnosis.title == title


def test_resolve_ssl_maps_every_mode():
    assert resolve_ssl(_config()) == (None, None, None)
    assert resolve_ssl(_config(verifySSL=VerifySSL.ignore)) == (False, None, None)

    verify, cert, ssl_manager = resolve_ssl(
        _config(verifySSL=VerifySSL.validate, sslConfig={"caCertificate": "-----BEGIN CERTIFICATE-----"})
    )
    try:
        assert verify == ssl_manager.ca_file_path
        assert cert is None
        assert Path(verify).read_text(encoding="utf-8") == "-----BEGIN CERTIFICATE-----"
    finally:
        ssl_manager.cleanup_temp_files()


def test_resolve_ssl_sends_a_client_certificate_for_mutual_tls():
    verify, cert, ssl_manager = resolve_ssl(
        _config(verifySSL=VerifySSL.ignore, sslConfig={"sslCertificate": "CERT", "sslKey": "KEY"})
    )
    try:
        assert verify is False
        assert [Path(path).read_text(encoding="utf-8") for path in cert] == ["CERT", "KEY"]
    finally:
        ssl_manager.cleanup_temp_files()


def test_client_is_built_with_the_verify_value_and_logs_out_on_close():
    with patch(f"{CONNECTION_MODULE}.MicroStrategyClient") as client_cls:
        conn = MicroStrategyConnection(_config(verifySSL=VerifySSL.ignore))
        client = conn.client
        conn.close()

    client_cls.assert_called_once_with(conn.service_connection, verify=False, cert=None)
    client.close_api_session.assert_called_once_with()
