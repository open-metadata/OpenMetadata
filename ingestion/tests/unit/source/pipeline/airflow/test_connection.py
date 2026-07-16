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
"""Unit tests for Airflow connection handling and its test-connection checks."""

from unittest.mock import MagicMock, patch

import pytest
from requests.exceptions import ConnectionError as RequestsConnectionError
from requests.exceptions import HTTPError, JSONDecodeError, SSLError, Timeout
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError

from metadata.core.connections.lifetime import Borrowed
from metadata.core.connections.test_connection import collect_checks
from metadata.core.connections.test_connection.check import CheckError
from metadata.core.connections.test_connection.checks.pipeline import PipelineStep
from metadata.core.connections.test_connection.network import NetworkUnreachableError
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.pipeline.airflow.api.client import AirflowApiClient
from metadata.ingestion.source.pipeline.airflow.connection import (
    AIRFLOW_ERRORS,
    AirflowChecks,
    AirflowConnection,
)

CONNECTION_MODULE = "metadata.ingestion.source.pipeline.airflow.connection"


def _rest_client(host="https://airflow.example.com:8080"):
    client = MagicMock(spec=AirflowApiClient)
    client.mwaa_client = None
    client.config = MagicMock()
    client.config.hostPort = host
    client.config.connection = MagicMock(authConfig=None, verifySSL=True)
    return client


def _rest_checks(client):
    return AirflowChecks(Borrowed.of(client))


def test_airflow_connection_is_base_connection():
    assert issubclass(AirflowConnection, BaseConnection)


def test_get_client_delegates_to_get_connection():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        conn = AirflowConnection(MagicMock())
        client = conn.client

    assert client is mock_get.return_value
    mock_get.assert_called_once_with(conn.service_connection)


def test_client_is_built_once_and_cached():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        conn = AirflowConnection(MagicMock())
        first = conn.client
        second = conn.client

    assert first is second
    mock_get.assert_called_once()


def test_engine_client_registers_dispose():
    engine = MagicMock(spec=Engine)
    with patch(f"{CONNECTION_MODULE}.get_connection", return_value=engine):
        conn = AirflowConnection(MagicMock())
        _ = conn.client
        conn.close()

    engine.dispose.assert_called_once()


def test_checks_expose_every_step():
    with patch(f"{CONNECTION_MODULE}.get_connection"):
        resolved = collect_checks(AirflowConnection(MagicMock()).checks())

    assert set(resolved) == {
        PipelineStep.CheckAccess,
        PipelineStep.PipelineDetailsAccess,
        PipelineStep.TaskDetailAccess,
    }


def test_checks_borrow_the_connection_client():
    """The provider borrows the client BaseConnection owns, rather than building a
    second one behind its back."""
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        conn = AirflowConnection(MagicMock())
        provider = conn.checks()

        assert provider.client is conn.client
        mock_get.assert_called_once()


# ── REST path ────────────────────────────────────────────────────────────────


@patch("metadata.core.connections.test_connection.network.tcp_probe")
def test_rest_check_access_reads_the_version(_mock_probe):
    client = _rest_client()
    client.get_version.return_value = {"version": "2.9.0"}

    evidence = _rest_checks(client).check_access()

    client.get_version.assert_called_once_with()
    assert evidence.summary == "authenticated"


@patch("metadata.core.connections.test_connection.network.tcp_probe")
def test_rest_check_access_failure_reports_a_check_error(_mock_probe):
    client = _rest_client()
    client.get_version.side_effect = RuntimeError("transport closed")

    with (
        patch(
            "metadata.ingestion.source.pipeline.airflow.api.diagnostics.diagnose",
            return_value=None,
        ),
        pytest.raises(CheckError) as failure,
    ):
        _rest_checks(client).check_access()

    assert failure.value.evidence.command == "read the Airflow REST API version"


@patch(
    "metadata.core.connections.test_connection.network.tcp_probe",
    side_effect=NetworkUnreachableError("10.0.0.1:8080 is not reachable"),
)
def test_rest_gate_preflights_an_unreachable_host(_mock_probe):
    """An unreachable host fails fast at the TCP preflight instead of waiting out
    the REST client's connect-retry budget; get_version is never called."""
    client = _rest_client(host="http://10.0.0.1:8080")

    with pytest.raises(CheckError) as failure:
        _rest_checks(client).check_access()

    assert failure.value.evidence.command == "TCP connect 10.0.0.1:8080"
    client.get_version.assert_not_called()
    assert AIRFLOW_ERRORS.classify(failure.value.cause).title == "Cannot reach the host"


@patch("metadata.core.connections.test_connection.network.tcp_probe")
def test_rest_gate_skips_preflight_for_mwaa(mock_probe):
    """MWAA reaches Airflow through the AWS SDK, not a socket to the host, so the
    preflight must not run for it."""
    client = _rest_client()
    client.mwaa_client = MagicMock()
    client.get_version.return_value = {"version": "2.9.0"}

    _rest_checks(client).check_access()

    mock_probe.assert_not_called()


def test_rest_pipeline_details_lists_one_dag():
    client = _rest_client()

    evidence = _rest_checks(client).pipeline_details_access()

    client.list_dags.assert_called_once_with(limit=1)
    assert evidence.summary == "authenticated"


def test_rest_task_detail_access_is_a_noop_pass():
    client = _rest_client()

    evidence = _rest_checks(client).task_detail_access()

    assert "per-DAG" in evidence.summary


# ── Backend (metadata-DB) path ───────────────────────────────────────────────


def test_backend_check_access_pings_the_engine():
    engine = create_engine("sqlite://")

    evidence = AirflowChecks(Borrowed.of(engine)).check_access()

    assert evidence.summary == "connection established"


def test_backend_step_reports_success():
    engine = create_engine("sqlite://")
    checks = AirflowChecks(Borrowed.of(engine))

    evidence = checks._backend_step(lambda session: None, command="SELECT 1", summary="ok")

    assert evidence.summary == "ok"
    assert evidence.command == "SELECT 1"


def test_backend_step_wraps_failures_in_a_check_error():
    engine = create_engine("sqlite://")
    checks = AirflowChecks(Borrowed.of(engine))

    def boom(_session):
        raise RuntimeError("no such table: serialized_dag")

    with pytest.raises(CheckError) as failure:
        checks._backend_step(boom, command="SELECT dag_id", summary="ok")

    assert failure.value.evidence.command == "SELECT dag_id"


# ── Error pack ───────────────────────────────────────────────────────────────


def _http_error(status_code):
    error = HTTPError(f"{status_code}")
    error.response = MagicMock(status_code=status_code)
    return error


@pytest.mark.parametrize(
    ("error", "title"),
    [
        (_http_error(401), "Authentication failed"),
        (_http_error(403), "Access denied"),
        (_http_error(404), "Endpoint not found"),
        (JSONDecodeError("Expecting value", "<html>", 0), "Host is not the Airflow REST API"),
        (SSLError("certificate verify failed"), "TLS verification failed"),
        (Timeout("timed out"), "Connection timed out"),
        (RequestsConnectionError("name resolution failed"), "Cannot reach the host"),
        (
            OperationalError("SELECT 1", {}, Exception("Access denied for user 'airflow'@'%'")),
            "Database authentication failed",
        ),
        (
            OperationalError("SELECT 1", {}, Exception('password authentication failed for user "airflow"')),
            "Database authentication failed",
        ),
    ],
)
def test_error_pack_diagnoses_known_failures(error, title):
    diagnosis = AIRFLOW_ERRORS.classify(error)

    assert diagnosis is not None
    assert diagnosis.title == title
    assert diagnosis.remediation


def test_db_matcher_ignores_a_rest_error_carrying_the_same_words():
    """A REST/transport error with no SQLAlchemy in its chain must not be diagnosed
    as a database problem just because its message says 'access denied'."""
    rest_error = RuntimeError("Access denied by the upstream proxy")

    assert AIRFLOW_ERRORS.classify(rest_error) is None


def test_error_pack_leaves_an_unknown_error_unclassified():
    assert AIRFLOW_ERRORS.classify(ValueError("something else")) is None
