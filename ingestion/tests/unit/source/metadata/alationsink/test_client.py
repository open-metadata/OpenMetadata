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
"""Unit tests for Alation Sink writes: batching and waiting on Alation's background jobs."""

from unittest.mock import MagicMock, patch

import requests

from metadata.generated.schema.entity.services.connections.metadata.alationSinkConnection import (
    AlationSinkConnection,
)
from metadata.ingestion.ometa.client import APIError, RestTransportError
from metadata.ingestion.source.metadata.alationsink.client import AlationSinkClient
from metadata.ingestion.source.metadata.alationsink.constants import JOB_POLL_REQUEST_TIMEOUT_SECONDS
from metadata.ingestion.source.metadata.alationsink.models import (
    CreateColumnRequest,
    CreateColumnRequestList,
)

CLIENT_MODULE = "metadata.ingestion.source.metadata.alationsink.client"


def _client(*jobs: dict) -> AlationSinkClient:
    """Client whose writes are accepted as job 7, and whose job polls answer `jobs` in order"""
    client = AlationSinkClient(AlationSinkConnection(hostPort="http://alation", authType={"accessToken": "token"}))
    client.client = MagicMock()
    client.client.post.return_value = {"job_id": 7}
    client.jobs_client = MagicMock()
    client.jobs_client.get.side_effect = list(jobs)
    client._sleep = MagicMock()
    return client


def _columns(count: int) -> CreateColumnRequestList:
    return CreateColumnRequestList(
        root=[CreateColumnRequest(key=f"39.sch.tbl.c{i}", title=f"c{i}", column_type="varchar") for i in range(count)]
    )


def test_waits_for_running_job_to_succeed():
    client = _client({"status": "running"}, {"status": "successful", "result": [{"errors": []}]})

    assert client.write_entities(39, _columns(3)) == []
    client.jobs_client.get.assert_called_with("/bulk_metadata/job/", data={"id": 7})
    assert client.jobs_client.get.call_count == 2
    client._sleep.assert_called_once()


def test_failed_job_returns_alation_error():
    client = _client(
        {"status": "failed", "msg": None, "result": {"detail": "Data source does not exist", "code": "404000"}}
    )

    errors = client.write_entities(39, _columns(3))

    assert len(errors) == 1
    assert "Data source does not exist" in errors[0]


def test_successful_job_with_rejected_objects_returns_their_errors():
    client = _client(
        {"status": "successful", "result": [{"response": "", "mapping": [], "errors": ["bad type", "bad key"]}]}
    )

    errors = client.write_entities(39, _columns(3))

    assert [error.split(": ", 1)[1] for error in errors] == ["bad type", "bad key"]


def test_job_still_running_at_timeout_is_a_failure():
    client = _client({"status": "running"})

    with patch(f"{CLIENT_MODULE}.JOB_TIMEOUT_SECONDS", 0):
        errors = client.write_entities(39, _columns(3))

    assert errors == ["Alation job [7] did not finish within 0s"]


def test_no_poll_starts_after_the_deadline():
    client = _client({"status": "running"}, {"status": "successful", "result": []})
    # deadline = 0 + 10; first check passes at 0, the post-sleep check lands past the deadline
    clock = iter([0, 0, 9.8, 11])

    with (
        patch(f"{CLIENT_MODULE}.JOB_TIMEOUT_SECONDS", 10),
        patch(f"{CLIENT_MODULE}.time.monotonic", lambda: next(clock)),
    ):
        errors = client.write_entities(39, _columns(3))

    assert errors == ["Alation job [7] did not finish within 10s"]
    assert client.jobs_client.get.call_count == 1
    # the sleep is cut to the time left rather than the full interval
    assert client._sleep.call_args.args[0] < 0.5


def _http_error(status_code: int) -> requests.HTTPError:
    response = requests.Response()
    response.status_code = status_code
    return requests.HTTPError(response=response)


def test_transient_poll_failures_keep_polling():
    client = _client(
        RestTransportError("GET", "/bulk_metadata/job/", TimeoutError("read timed out")),
        _http_error(503),
        {"status": "successful", "result": []},
    )

    assert client.write_entities(39, _columns(3)) == []
    assert client.jobs_client.get.call_count == 3


def test_permanent_poll_failure_stops_polling():
    client = _client(
        APIError({"code": "404000", "detail": "Job does not exist"}, _http_error(404)),
        {"status": "successful", "result": []},
    )

    errors = client.write_entities(39, _columns(3))

    assert errors == ["Polling Alation job [7] failed: Job does not exist"]
    assert client.jobs_client.get.call_count == 1


def test_timeout_reports_the_last_poll_error():
    client = _client(_http_error(503), _http_error(502))
    clock = iter([0, 0, 1, 1, 1, 11])

    with (
        patch(f"{CLIENT_MODULE}.JOB_TIMEOUT_SECONDS", 10),
        patch(f"{CLIENT_MODULE}.time.monotonic", lambda: next(clock)),
    ):
        errors = client.write_entities(39, _columns(3))

    assert len(errors) == 1
    assert errors[0].startswith("Alation job [7] did not finish within 10s (last poll error:")
    assert client.jobs_client.get.call_count == 2


def test_job_polls_are_bounded():
    client = AlationSinkClient(AlationSinkConnection(hostPort="http://alation", authType={"accessToken": "token"}))

    assert client.jobs_client._timeout == (10, JOB_POLL_REQUEST_TIMEOUT_SECONDS)
    assert client.jobs_client._retry == 0


def test_response_without_job_is_synchronous_success():
    client = _client()
    client.client.post.return_value = {"id": 1}

    assert client.write_entities(39, _columns(3)) == []
    client.jobs_client.get.assert_not_called()


def test_rejected_post_returns_its_error():
    client = _client()
    client.client.post.side_effect = RuntimeError("Invalid Payload")

    assert client.write_entities(39, _columns(3)) == ["Invalid Payload"]


def test_writes_are_batched():
    client = _client(*[{"status": "successful", "result": []}] * 3)

    assert client.write_entities(39, _columns(2500)) == []
    batch_sizes = [len(call.kwargs["json"]) for call in client.client.post.call_args_list]
    assert batch_sizes == [1000, 1000, 500]
    assert client.client.post.call_args.args == ("/v2/column/?ds_id=39",)
