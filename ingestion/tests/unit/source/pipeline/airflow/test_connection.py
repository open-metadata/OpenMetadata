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
import requests
from botocore.exceptions import ClientError
from requests.exceptions import ConnectionError as RequestsConnectionError
from requests.exceptions import HTTPError, JSONDecodeError, SSLError, Timeout
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError

from metadata.core.connections.lifetime import Borrowed
from metadata.core.connections.test_connection import collect_checks
from metadata.core.connections.test_connection.check import CheckError
from metadata.core.connections.test_connection.checks.pipeline import PipelineStep
from metadata.core.connections.test_connection.classifier import exception_chain
from metadata.core.connections.test_connection.network import NetworkUnreachableError
from metadata.generated.schema.entity.services.connections.pipeline.airflowConnection import (
    AirflowConnection as AirflowConnectionConfig,
)
from metadata.generated.schema.entity.utils.airflowRestApiConnection import (
    AirflowRestApiConnection,
    ApiVersion,
)
from metadata.generated.schema.entity.utils.common.accessTokenConfig import AccessToken
from metadata.generated.schema.entity.utils.common.mwaaAuthConfig import (
    MwaaAuthentication,
    MwaaConfig,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
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


def test_get_client_builds_engine_via_dispatch():
    with patch(f"{CONNECTION_MODULE}._get_connection") as mock_get:
        conn = AirflowConnection(MagicMock())
        client = conn.client

    assert client is mock_get.return_value
    mock_get.assert_called_once_with(conn.service_connection.connection)


def test_client_is_built_once_and_cached():
    with patch(f"{CONNECTION_MODULE}._get_connection") as mock_get:
        conn = AirflowConnection(MagicMock())
        first = conn.client
        second = conn.client

    assert first is second
    mock_get.assert_called_once()


def test_engine_client_registers_dispose():
    engine = MagicMock(spec=Engine)
    with patch(f"{CONNECTION_MODULE}._get_connection", return_value=engine):
        conn = AirflowConnection(MagicMock())
        _ = conn.client
        conn.close()

    engine.dispose.assert_called_once()


def test_checks_expose_every_step():
    with patch(f"{CONNECTION_MODULE}._get_connection"):
        resolved = collect_checks(AirflowConnection(MagicMock()).checks())

    assert set(resolved) == {
        PipelineStep.CheckAccess,
        PipelineStep.PipelineDetailsAccess,
        PipelineStep.TaskDetailAccess,
    }


def test_checks_borrow_the_connection_client():
    """The provider borrows the client BaseConnection owns, rather than building a
    second one behind its back."""
    with patch(f"{CONNECTION_MODULE}._get_connection") as mock_get:
        conn = AirflowConnection(MagicMock())
        provider = conn.checks()

        assert provider.client is conn.client
        mock_get.assert_called_once()


# ── REST path ────────────────────────────────────────────────────────────────


@patch("metadata.core.connections.test_connection.network.tcp_probe")
def test_rest_check_access_reads_the_version_via_the_strict_accessor(_mock_probe):
    """The gate must read the version through test_get_version, not get_version:
    the latter tolerates an unparseable reply and would pass against any host."""
    client = _rest_client()
    client.test_get_version.return_value = {"version": "2.9.0"}

    evidence = _rest_checks(client).check_access()

    client.test_get_version.assert_called_once_with()
    client.get_version.assert_not_called()
    assert evidence.summary == "authenticated"


@patch("metadata.core.connections.test_connection.network.tcp_probe")
def test_rest_check_access_failure_reports_a_check_error(_mock_probe):
    client = _rest_client()
    client.test_get_version.side_effect = RuntimeError("transport closed")

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


def test_rest_task_detail_access_reads_one_dags_tasks():
    client = _rest_client()
    client.list_dags.return_value = {"dags": [{"dag_id": "d"}]}
    client.get_dag_tasks.return_value = {"tasks": [{"task_id": "t"}]}

    evidence = _rest_checks(client).task_detail_access()

    client.get_dag_tasks.assert_called_once_with("d")
    assert evidence is not None
    assert evidence.summary == "authenticated"


def test_rest_task_detail_access_passes_when_no_dags_to_probe():
    client = _rest_client()
    client.list_dags.return_value = {"dags": []}

    _rest_checks(client).task_detail_access()

    client.get_dag_tasks.assert_not_called()


def test_rest_task_detail_access_passes_on_any_reachable_response():
    client = _rest_client()
    client.list_dags.return_value = {"dags": [{"dag_id": "d"}]}
    client.get_dag_tasks.return_value = {}

    evidence = _rest_checks(client).task_detail_access()

    client.get_dag_tasks.assert_called_once_with("d")
    assert evidence is not None
    assert evidence.summary == "authenticated"


def test_rest_task_detail_access_fails_when_the_tasks_endpoint_errors():
    client = _rest_client()
    client.list_dags.return_value = {"dags": [{"dag_id": "d"}]}
    client.get_dag_tasks.side_effect = RuntimeError("403 Forbidden")

    with pytest.raises(CheckError):
        _rest_checks(client).task_detail_access()


# ── REST path, driving the real AirflowApiClient ─────────────────────────────
#
# The tests above mock AirflowApiClient wholesale, so they prove only that the
# provider calls it - never that the client surfaces a non-Airflow host. These
# drive the real client (and the real REST plumbing under it) by stubbing only
# the outermost seam, requests.Session.request.


def _real_rest_client(host="https://airflow.example.com:8080") -> AirflowApiClient:
    """A real AirflowApiClient. apiVersion is pinned so the gate makes exactly one
    HTTP call and the test is not coupled to version auto-detection."""
    config = AirflowConnectionConfig(
        hostPort=host,
        connection=AirflowRestApiConnection(
            authConfig=AccessToken(token="a-token"),
            apiVersion=ApiVersion.v2,
        ),
    )
    return AirflowApiClient(config)


def _html_response(status_code: int = 200) -> requests.Response:
    """A real Response with an HTML body - what a host that is not the Airflow REST
    API answers with. Real, so response.json() raises the genuine JSONDecodeError."""
    response = requests.Response()
    response.status_code = status_code
    response._content = b"<!doctype html><html><body>Sign in</body></html>"
    response.headers["content-type"] = "text/html; charset=utf-8"
    response.url = "https://airflow.example.com:8080/api/v2/version"
    return response


@patch("metadata.core.connections.test_connection.network.tcp_probe")
def test_rest_gate_fails_against_a_host_that_is_not_airflow(_mock_probe):
    """Regression: REST.get returns the raw Response when the body will not decode,
    and _parse_response swallowed that into {} - so the gate went green against any
    web server answering 200 text/html."""
    client = _real_rest_client()

    with (
        patch.object(requests.Session, "request", return_value=_html_response()),
        pytest.raises(CheckError) as failure,
    ):
        _rest_checks(client).check_access()

    assert AIRFLOW_ERRORS.classify(failure.value.cause).title == "Host is not the Airflow REST API"


@patch("metadata.core.connections.test_connection.network.tcp_probe")
def test_rest_gate_passes_against_a_real_airflow_version_payload(_mock_probe):
    """The counterpart: a genuine Airflow /version JSON body still passes the gate."""
    client = _real_rest_client()
    response = requests.Response()
    response.status_code = 200
    response._content = b'{"version": "2.9.0", "git_version": "abc"}'
    response.headers["content-type"] = "application/json"

    with patch.object(requests.Session, "request", return_value=response):
        evidence = _rest_checks(client).check_access()

    assert evidence.summary == "authenticated"


@patch("metadata.core.connections.test_connection.network.tcp_probe")
def test_rest_gate_fails_on_an_unauthorized_reply(_mock_probe):
    """A 401 from the real client must fail the gate and diagnose as auth."""
    client = _real_rest_client()

    with (
        patch.object(requests.Session, "request", return_value=_html_response(status_code=401)),
        pytest.raises(CheckError) as failure,
    ):
        _rest_checks(client).check_access()

    assert AIRFLOW_ERRORS.classify(failure.value.cause).title == "Authentication failed"


@patch("metadata.core.connections.test_connection.network.tcp_probe")
def test_rest_gate_surfaces_a_malformed_host_error(_mock_probe):
    """Regression: get_raw returned None for an exception outside its transport tuple
    (a mistyped host raises MissingSchema), so the gate hit AttributeError on None.
    It now re-raises the real cause instead of swallowing it."""
    client = _real_rest_client()

    with (
        patch.object(requests.Session, "request", side_effect=requests.exceptions.MissingSchema("bad url")),
        pytest.raises(CheckError) as failure,
    ):
        _rest_checks(client).check_access()

    assert isinstance(failure.value.cause, requests.exceptions.MissingSchema)
    assert not isinstance(failure.value.cause, AttributeError)


@patch("metadata.core.connections.test_connection.network.tcp_probe")
def test_rest_gate_diagnoses_a_rate_limit_with_a_readable_error(_mock_probe):
    """Regression: a 429 raised LimitsException with an empty message, so the gate's
    errorLog was blank. The real HTTPError (status 429) is surfaced instead."""
    client = _real_rest_client()
    response = _html_response(status_code=429)

    with (
        patch.object(requests.Session, "request", return_value=response),
        pytest.raises(CheckError) as failure,
    ):
        _rest_checks(client).check_access()

    assert AIRFLOW_ERRORS.classify(failure.value.cause).title == "Rate limited"
    assert "429" in str(failure.value.cause)


# ── MWAA flavour ─────────────────────────────────────────────────────────────


def _mwaa_client() -> AirflowApiClient:
    """A real AirflowApiClient on the MWAA path, with only the boto3 client stubbed."""
    config = AirflowConnectionConfig(
        hostPort="https://airflow.example.com:8080",
        connection=AirflowRestApiConnection(
            authConfig=MwaaAuthentication(
                mwaaConfig=MwaaConfig(
                    awsConfig=AWSCredentials(awsRegion="us-east-1"),
                    mwaaEnvironmentName="my-environment",
                )
            )
        ),
    )
    with patch("metadata.ingestion.source.pipeline.airflow.api.mwaa.AWSClient"):
        return AirflowApiClient(config)


def test_mwaa_gate_fails_when_aws_rejects_the_call():
    """Regression: MWAAClient.get_version is hardcoded and never calls AWS, so the
    gate passed unconditionally - bad credentials, wrong environment, no route."""
    client = _mwaa_client()
    denied = ClientError(
        {"Error": {"Code": "AccessDeniedException", "Message": "not authorized to perform mwaa:InvokeRestApi"}},
        "InvokeRestApi",
    )
    client.mwaa_client._mwaa_client.invoke_rest_api.side_effect = denied

    with pytest.raises(CheckError) as failure:
        _rest_checks(client).check_access()

    assert failure.value.evidence.command == "read the Airflow REST API version"
    # The MWAA diagnostics hint wraps the AWS error, which stays in the chain.
    assert any(isinstance(current, ClientError) for current in exception_chain(failure.value.cause))


def test_mwaa_gate_passes_when_the_environment_answers():
    client = _mwaa_client()
    client.mwaa_client._mwaa_client.invoke_rest_api.return_value = {"RestApiResponse": {"dags": [], "total_entries": 0}}

    evidence = _rest_checks(client).check_access()

    assert evidence.summary == "authenticated"
    client.mwaa_client._mwaa_client.invoke_rest_api.assert_called_once()


def test_mwaa_gate_calls_aws_with_the_configured_environment():
    """The call must name the configured environment - that is half of what the gate
    is proving."""
    client = _mwaa_client()
    client.mwaa_client._mwaa_client.invoke_rest_api.return_value = {"RestApiResponse": {}}

    _rest_checks(client).check_access()

    kwargs = client.mwaa_client._mwaa_client.invoke_rest_api.call_args.kwargs
    assert kwargs["Name"] == "my-environment"
    assert kwargs["Path"] == "/dags"


def test_ingestion_mwaa_get_version_stays_a_stub():
    """get_version is on the ingestion path and stays hardcoded; only the
    test-connection accessor makes a real call."""
    client = _mwaa_client()

    assert client.get_version() == {"version": "MWAA", "status": "connected"}
    client.mwaa_client._mwaa_client.invoke_rest_api.assert_not_called()


def test_ingestion_get_version_still_tolerates_a_non_json_reply():
    """get_version is on the ingestion path and must keep its lenient behaviour;
    only the test-connection accessor is strict. Guards against the fix being
    applied to the wrong method."""
    client = _real_rest_client()

    with patch.object(requests.Session, "request", return_value=_html_response()):
        assert client.get_version() == {}


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
