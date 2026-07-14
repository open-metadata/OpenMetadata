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
"""Unit tests for dbt Cloud connection handling and its test-connection checks."""

from unittest.mock import MagicMock, patch

import pytest
from requests.exceptions import ConnectionError as RequestsConnectionError
from requests.exceptions import ReadTimeout, SSLError

from metadata.core.connections.test_connection import collect_checks
from metadata.core.connections.test_connection.check import CheckError
from metadata.core.connections.test_connection.checks.pipeline import PipelineStep
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.pipeline.dbtcloud.client import DBTCloudApiError
from metadata.ingestion.source.pipeline.dbtcloud.connection import (
    DBTCLOUD_ERRORS,
    DBTCloudChecks,
    DBTCloudConnection,
)

CONNECTION_MODULE = "metadata.ingestion.source.pipeline.dbtcloud.connection"


@pytest.fixture
def client():
    return MagicMock()


@pytest.fixture
def checks(client):
    return DBTCloudChecks(client=client)


def test_dbtcloud_connection_is_base_connection():
    assert issubclass(DBTCloudConnection, BaseConnection)


def test_get_client_builds_the_client():
    with patch(f"{CONNECTION_MODULE}.DBTCloudClient") as mock_builder:
        conn = DBTCloudConnection(MagicMock())
        built = conn.client

    assert built is mock_builder.return_value
    mock_builder.assert_called_once()


def test_checks_expose_every_step():
    with patch(f"{CONNECTION_MODULE}.DBTCloudClient"):
        resolved = collect_checks(DBTCloudConnection(MagicMock()).checks())

    assert set(resolved) == {
        PipelineStep.CheckAccess,
        PipelineStep.GetJobs,
        PipelineStep.GetRuns,
    }


def test_checks_run_against_the_connection_client():
    """The provider checks the client BaseConnection owns, rather than opening a
    second one behind its back."""
    with patch(f"{CONNECTION_MODULE}.DBTCloudClient") as mock_builder:
        conn = DBTCloudConnection(MagicMock())
        provider = conn.checks()

    assert provider._client is conn.client
    mock_builder.assert_called_once()


def test_check_access_proves_the_account_is_readable(checks, client):
    evidence = checks.check_access()

    client.test_check_access.assert_called_once_with()
    assert evidence.summary == "authenticated"
    assert evidence.command == "read one job of the configured account"


def test_get_jobs_counts_the_jobs(checks, client):
    client.test_get_jobs.return_value = [MagicMock(), MagicMock()]

    evidence = checks.get_jobs()

    assert evidence.summary == "2 jobs enumerated"
    assert evidence.caveat is None


def test_get_jobs_caveats_an_account_with_no_jobs(checks, client):
    client.test_get_jobs.return_value = []

    evidence = checks.get_jobs()

    assert evidence.summary == "0 jobs enumerated"
    assert evidence.caveat is not None
    assert evidence.caveat.title == "No jobs visible"


def test_get_runs_counts_the_runs(checks, client):
    client.test_get_runs.return_value = [MagicMock()]

    evidence = checks.get_runs()

    assert evidence.summary == "1 run enumerated"


def test_a_failed_check_still_reports_what_it_ran(checks, client):
    client.test_get_runs.side_effect = DBTCloudApiError(403, "/accounts/1/runs/", "forbidden")

    with pytest.raises(CheckError) as failure:
        checks.get_runs()

    assert failure.value.evidence.command == "fetch the runs of the account"
    assert failure.value.cause is client.test_get_runs.side_effect


# The bodies dbt Cloud really answers with, captured against the live API: a wrong
# account id is a 403, never a 404.
NOT_SCOPED_BODY = (
    '{"status": {"code": 403, "is_success": false, '
    '"user_message": "Access denied: Token is not scoped to account.", "developer_message": null}, "data": null}'
)
INVALID_TOKEN_BODY = (
    '{"status": {"code": 401, "is_success": false, '
    '"user_message": "Invalid token.", "developer_message": null}, "data": null}'
)


@pytest.mark.parametrize(
    ("error", "title"),
    [
        (
            DBTCloudApiError(403, "/accounts/99999/jobs/", NOT_SCOPED_BODY),
            "Token is not scoped to this account",
        ),
        (DBTCloudApiError(401, "/accounts/1/jobs/", INVALID_TOKEN_BODY), "Authentication failed"),
        (DBTCloudApiError(403, "/accounts/1/jobs/", "forbidden"), "Access denied"),
        (DBTCloudApiError(429, "/accounts/1/jobs/", "too many requests"), "Rate limited"),
        (SSLError("certificate verify failed"), "TLS verification failed"),
        (ReadTimeout("timed out"), "Connection timed out"),
        (RequestsConnectionError("name resolution failed"), "Cannot reach the host"),
    ],
)
def test_error_pack_diagnoses_known_failures(error, title):
    diagnosis = DBTCLOUD_ERRORS.classify(error)

    assert diagnosis is not None
    assert diagnosis.title == title
    assert diagnosis.remediation


def test_error_pack_diagnoses_a_status_wrapped_by_a_check_error():
    """The runner classifies the cause of a CheckError, but a connector error can
    also surface wrapped; the matcher walks the chain either way."""
    cause = DBTCloudApiError(401, "/accounts/1/jobs/", "unauthorized")
    wrapped = RuntimeError("step failed")
    wrapped.__cause__ = cause

    assert DBTCLOUD_ERRORS.classify(wrapped).title == "Authentication failed"


def test_error_pack_leaves_an_unknown_error_unclassified():
    assert DBTCLOUD_ERRORS.classify(ValueError("something else")) is None


CLIENT_MODULE = "metadata.ingestion.source.pipeline.dbtcloud.client"


def _dbtcloud_client(host="https://cloud.getdbt.com", account_id=1):
    with patch(f"{CLIENT_MODULE}.TrackedREST"):
        from metadata.ingestion.source.pipeline.dbtcloud.client import DBTCloudClient

        config = MagicMock()
        config.host = host
        config.accountId = account_id
        config.token.get_secret_value.return_value = "secret-token"

        return DBTCloudClient(config)


def test_test_check_access_reads_a_single_job():
    client = _dbtcloud_client()
    with patch(f"{CLIENT_MODULE}.requests.get") as mock_get:
        mock_get.return_value.ok = True
        mock_get.return_value.json.return_value = {"data": []}

        client.test_check_access()

    url, kwargs = mock_get.call_args[0][0], mock_get.call_args[1]
    assert url == "https://cloud.getdbt.com/api/v2/accounts/1/jobs/"
    assert kwargs["params"] == {"limit": 1, "offset": 0}
    assert kwargs["headers"]["Authorization"] == "Bearer secret-token"


def test_a_rejected_token_surfaces_its_http_status():
    """A dbt Cloud error body nests its code under `status`; the status must still
    reach the error pack, or a bad token reads as an opaque validation error."""
    client = _dbtcloud_client()
    with patch(f"{CLIENT_MODULE}.requests.get") as mock_get:
        mock_get.return_value.ok = False
        mock_get.return_value.status_code = 401
        mock_get.return_value.text = INVALID_TOKEN_BODY

        with pytest.raises(DBTCloudApiError) as failure:
            client.test_get_jobs()

    assert failure.value.status_code == 401
    assert DBTCLOUD_ERRORS.classify(failure.value).title == "Authentication failed"
