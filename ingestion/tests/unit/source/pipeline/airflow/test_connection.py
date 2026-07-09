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
"""Unit tests for Airflow connection handling."""

from unittest.mock import MagicMock, patch

import pytest

from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.pipeline.airflow.connection import (
    AirflowConnection,
    AirflowTaskDetailsAccessError,
    _test_task_detail_access_rest,
)

CONNECTION_MODULE = "metadata.ingestion.source.pipeline.airflow.connection"


def _client(dags, tasks=None):
    client = MagicMock()
    client.list_dags.return_value = dags
    if isinstance(tasks, Exception):
        client.get_dag_tasks.side_effect = tasks
    else:
        client.get_dag_tasks.return_value = tasks
    return client


def test_airflow_connection_is_base_connection():
    assert issubclass(AirflowConnection, BaseConnection)


def test_get_client_delegates_to_get_connection():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        conn = AirflowConnection(MagicMock())
        client = conn.client

    assert client is mock_get.return_value
    mock_get.assert_called_once_with(conn.service_connection)


def test_test_connection_runs_steps():
    conn = AirflowConnection(MagicMock())
    conn._client = MagicMock()
    with patch(f"{CONNECTION_MODULE}.test_connection") as mock_step:
        result = conn.test_connection(metadata=MagicMock())

    assert result is mock_step.return_value


class TestTaskDetailAccessRest:
    """P1-6: REST/MWAA TaskDetailAccess must actually read /tasks, not no-op."""

    def test_healthy_returns_true(self):
        client = _client({"dags": [{"dag_id": "d"}]}, {"tasks": [{"task_id": "t"}]})
        assert _test_task_detail_access_rest(client) is True
        client.get_dag_tasks.assert_called_once_with("d")

    def test_dag_with_zero_tasks_passes(self):
        client = _client({"dags": [{"dag_id": "d"}]}, {"tasks": []})
        assert _test_task_detail_access_rest(client) is True

    def test_no_dags_passes_without_probing_tasks(self):
        client = _client({"dags": []})
        assert _test_task_detail_access_rest(client) is True
        client.get_dag_tasks.assert_not_called()

    def test_null_listing_passes(self):
        assert _test_task_detail_access_rest(_client(None)) is True
        assert _test_task_detail_access_rest(_client({})) is True

    def test_missing_tasks_key_raises(self):
        client = _client({"dags": [{"dag_id": "d"}]}, {})
        with pytest.raises(AirflowTaskDetailsAccessError):
            _test_task_detail_access_rest(client)

    def test_non_dict_task_response_raises(self):
        client = _client({"dags": [{"dag_id": "d"}]}, None)
        with pytest.raises(AirflowTaskDetailsAccessError):
            _test_task_detail_access_rest(client)

    def test_get_dag_tasks_error_propagates(self):
        client = _client({"dags": [{"dag_id": "d"}]}, RuntimeError("403 Forbidden"))
        with pytest.raises(RuntimeError):
            _test_task_detail_access_rest(client)
