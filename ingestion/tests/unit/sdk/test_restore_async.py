#  Copyright 2026 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Tests for the fluent restore + server-side async option (issue #4003)."""

from unittest.mock import MagicMock

import pytest

from metadata.sdk import Tables
from metadata.sdk.entities.base import AsyncJobResponse, RestoreOperation


@pytest.fixture
def mock_client():
    client = MagicMock()
    client.get_suffix.return_value = "/tables"
    rest_client = MagicMock()
    client.client = rest_client
    Tables.set_default_client(client)
    return client


def _table_payload(table_id: str) -> dict:
    """Minimum dict shape that pydantic_core accepts as a Table."""
    return {
        "id": table_id,
        "name": "t",
        "fullyQualifiedName": "service.db.schema.t",
        "deleted": False,
        "columns": [],
    }


def test_restore_sync_calls_put_without_async_param(mock_client):
    table_id = "b67eac63-9e43-41f5-afb9-387c85df1d8b"
    rest_client = mock_client.client
    rest_client.put.return_value = _table_payload(table_id)

    Tables.restore(table_id)

    rest_client.put.assert_called_once()
    path = rest_client.put.call_args[0][0]
    assert path.endswith("/restore")
    assert "async=true" not in path


def test_restore_async_appends_async_query_param(mock_client):
    table_id = "b67eac63-9e43-41f5-afb9-387c85df1d8b"
    rest_client = mock_client.client
    rest_client.put.return_value = {"jobId": "job-42", "message": "Restore initiated"}

    response = Tables.restore_async(table_id)

    assert isinstance(response, AsyncJobResponse)
    assert response.job_id == "job-42"
    assert response.message == "Restore initiated"
    rest_client.put.assert_called_once()
    path = rest_client.put.call_args[0][0]
    assert path.endswith("/restore?async=true")


def test_fluent_restore_request_sync_returns_entity(mock_client):
    table_id = "b67eac63-9e43-41f5-afb9-387c85df1d8b"
    rest_client = mock_client.client
    rest_client.put.return_value = _table_payload(table_id)

    op = Tables.restore_request(table_id)
    assert isinstance(op, RestoreOperation)
    op.execute()

    path = rest_client.put.call_args[0][0]
    assert "async=true" not in path


def test_fluent_restore_request_with_async_returns_job_response(mock_client):
    table_id = "b67eac63-9e43-41f5-afb9-387c85df1d8b"
    rest_client = mock_client.client
    rest_client.put.return_value = {"jobId": "job-7", "message": "Restore initiated"}

    job = Tables.restore_request(table_id).with_async().execute()

    assert isinstance(job, AsyncJobResponse)
    assert job.job_id == "job-7"
    assert "async=true" in rest_client.put.call_args[0][0]


def test_async_job_response_from_response_handles_dict():
    response = AsyncJobResponse.from_response({"jobId": "abc", "message": "ok"})
    assert response.job_id == "abc"
    assert response.message == "ok"


def test_async_job_response_from_response_passes_through_existing():
    original = AsyncJobResponse(job_id="abc", message="ok")
    assert AsyncJobResponse.from_response(original) is original


def test_async_job_response_from_response_rejects_unknown_type():
    with pytest.raises(TypeError):
        AsyncJobResponse.from_response("not a dict")


def test_async_job_response_from_response_rejects_missing_job_id():
    with pytest.raises(ValueError, match="non-empty jobId"):
        AsyncJobResponse.from_response({"message": "no id here"})


def test_async_job_response_from_response_rejects_empty_job_id():
    with pytest.raises(ValueError, match="non-empty jobId"):
        AsyncJobResponse.from_response({"jobId": "", "message": "blank"})
