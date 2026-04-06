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
"""
Tests for AirflowApi pipeline connector
"""

from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from requests.exceptions import ConnectionError as RequestsConnectionError
from requests.exceptions import HTTPError

from metadata.generated.schema.entity.data.pipeline import PipelineState, StatusType
from metadata.generated.schema.entity.utils.common.accessTokenConfig import AccessToken
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.source.pipeline.airflow.api.client import AirflowApiClient
from metadata.ingestion.source.pipeline.airflow.api.models import (
    AirflowApiDagDetails,
    AirflowApiDagRun,
    AirflowApiTask,
    AirflowApiTaskInstance,
)
from metadata.ingestion.source.pipeline.airflow.api.source import (
    STATUS_MAP,
    AirflowApiSource,
)
from metadata.utils.helpers import datetime_to_ts

# ── Shared Helpers ───────────────────────────────────────────────────────


def _make_client(mock_rest_cls, api_version="v1"):
    """Create an AirflowApiClient with mocked TrackedREST using AccessToken auth."""
    mock_rest_cls.return_value = MagicMock()
    auth_config = AccessToken(token="test_token")
    rest_config = MagicMock()
    rest_config.authConfig = auth_config
    rest_config.apiVersion = MagicMock()
    rest_config.apiVersion.value = api_version
    rest_config.verifySSL = True
    config = MagicMock()
    config.hostPort = "http://localhost:8080"
    config.connection = rest_config
    client = AirflowApiClient(config)
    return client, mock_rest_cls.return_value


def _make_source_and_dag(task_names=None):
    """Create a mocked AirflowApiSource and a minimal DAG for status/pipeline tests."""
    source = MagicMock()
    source.service_connection = MagicMock()
    source.service_connection.numberOfStatus = 5
    source.service_connection.hostPort = "http://airflow.example.com:8080"

    context = MagicMock()
    context.pipeline_service = "test_service"
    context.pipeline = "test_dag"
    context.task_names = task_names or {"task_1"}
    source.context.get.return_value = context

    source.connection = MagicMock()
    source.connection.api_version = "v1"
    source.metadata = MagicMock()
    source.source_config = MagicMock()
    source.source_config.includeTags = True

    source._get_dag_source_url = (
        lambda dag_id: f"http://airflow.example.com:8080/dags/{dag_id}/grid"
    )
    source._get_task_source_url = lambda dag_id, task_id: (
        f"http://airflow.example.com:8080/taskinstance/list/"
        f"?_flt_3_dag_id={dag_id}&_flt_3_task_id={task_id}"
    )
    source._build_tasks = lambda details: AirflowApiSource._build_tasks(source, details)
    source.register_record = MagicMock()
    source.get_pipeline_state = lambda details: (
        (PipelineState.Inactive if details.is_paused else PipelineState.Active)
        if details.is_paused is not None
        else None
    )

    dag = AirflowApiDagDetails(
        dag_id="test_dag",
        description="A test pipeline",
        is_paused=False,
        tags=["team:data"],
        schedule_interval="@daily",
        tasks=[
            AirflowApiTask(
                task_id="task_1",
                downstream_task_ids=["task_2"],
                class_ref={"class_name": "PythonOperator"},
                doc_md="Task 1 docs",
            ),
            AirflowApiTask(task_id="task_2"),
        ],
    )
    return source, dag


# ── Status Mapping ───────────────────────────────────────────────────────


class TestStatusMapping:
    def test_success_maps_to_successful(self):
        assert STATUS_MAP["success"] == StatusType.Successful.value

    def test_failed_maps_to_failed(self):
        assert STATUS_MAP["failed"] == StatusType.Failed.value

    def test_queued_maps_to_pending(self):
        assert STATUS_MAP["queued"] == StatusType.Pending.value

    def test_skipped_maps_to_skipped(self):
        assert STATUS_MAP["skipped"] == StatusType.Skipped.value

    def test_running_maps_to_pending(self):
        assert STATUS_MAP["running"] == StatusType.Pending.value

    def test_upstream_failed_maps_to_failed(self):
        assert STATUS_MAP["upstream_failed"] == StatusType.Failed.value

    def test_unknown_state_defaults(self):
        assert (
            STATUS_MAP.get("nonexistent", StatusType.Pending.value)
            == StatusType.Pending.value
        )


# ── Models ───────────────────────────────────────────────────────────────


class TestModels:
    def test_dag_details_minimal(self):
        dag = AirflowApiDagDetails(dag_id="test_dag")
        assert dag.dag_id == "test_dag"
        assert dag.tasks == []
        assert dag.tags is None

    def test_dag_details_with_tasks(self):
        dag = AirflowApiDagDetails(
            dag_id="test_dag",
            description="A test dag",
            is_paused=False,
            tasks=[
                AirflowApiTask(
                    task_id="task_1",
                    downstream_task_ids=["task_2"],
                    class_ref={"class_name": "BashOperator"},
                ),
                AirflowApiTask(task_id="task_2"),
            ],
        )
        assert len(dag.tasks) == 2
        assert dag.tasks[0].downstream_task_ids == ["task_2"]
        assert dag.tasks[0].class_ref["class_name"] == "BashOperator"

    def test_dag_run(self):
        run = AirflowApiDagRun(
            dag_run_id="manual__2024-01-01",
            state="success",
        )
        assert run.dag_run_id == "manual__2024-01-01"
        assert run.state == "success"

    def test_task_instance(self):
        ti = AirflowApiTaskInstance(
            task_id="task_1",
            state="success",
        )
        assert ti.task_id == "task_1"
        assert ti.state == "success"


# ── Client: API Version Detection ────────────────────────────────────────


class TestClientApiVersionDetection:
    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_auto_detect_v2(self, mock_rest_cls):
        client, mock_rest = _make_client(mock_rest_cls, api_version="auto")
        mock_rest.get.return_value = {"version": "3.0.0"}
        assert client.api_version == "v2"

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_auto_detect_v1_fallback(self, mock_rest_cls):
        client, mock_rest = _make_client(mock_rest_cls, api_version="auto")

        def side_effect(path):
            if "/v2/" in path:
                raise Exception("Not found")
            return {"version": "2.9.0"}

        mock_rest.get.side_effect = side_effect
        assert client.api_version == "v1"

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_explicit_version(self, mock_rest_cls):
        client, _ = _make_client(mock_rest_cls, api_version="v1")
        assert client.api_version == "v1"


# ── Client: Build DAG Details ────────────────────────────────────────────


class TestClientBuildDagDetails:
    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_build_dag_details_normalizes_tags(self, mock_rest_cls):
        client, mock_rest = _make_client(mock_rest_cls)
        mock_rest.get.return_value = {"tasks": []}

        dag_data = {
            "dag_id": "test_dag",
            "tags": [{"name": "team:data"}, {"name": "env:prod"}],
            "owners": ["admin"],
        }
        result = client.build_dag_details(dag_data)
        assert result.tags == ["team:data", "env:prod"]
        assert result.owners == ["admin"]

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_build_dag_details_with_tasks(self, mock_rest_cls):
        client, mock_rest = _make_client(mock_rest_cls)
        mock_rest.get.return_value = {
            "tasks": [
                {
                    "task_id": "extract",
                    "downstream_task_ids": ["transform"],
                    "class_ref": {
                        "class_name": "PythonOperator",
                        "module_path": "airflow.operators.python",
                    },
                },
                {
                    "task_id": "transform",
                    "downstream_task_ids": [],
                    "class_ref": {
                        "class_name": "BashOperator",
                        "module_path": "airflow.operators.bash",
                    },
                },
            ]
        }

        dag_data = {"dag_id": "etl_pipeline", "tags": [], "owners": []}
        result = client.build_dag_details(dag_data)
        assert len(result.tasks) == 2
        assert result.tasks[0].task_id == "extract"
        assert result.tasks[0].downstream_task_ids == ["transform"]
        assert result.tasks[0].class_ref["class_name"] == "PythonOperator"


# ── Client: Date Field ───────────────────────────────────────────────────


class TestClientDateField:
    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_v1_uses_execution_date(self, mock_rest_cls):
        client, _ = _make_client(mock_rest_cls, api_version="v1")
        assert client._date_field == "execution_date"

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_v2_uses_logical_date(self, mock_rest_cls):
        client, _ = _make_client(mock_rest_cls, api_version="v2")
        assert client._date_field == "logical_date"


# ── Source URL Generation ────────────────────────────────────────────────


class TestSourceUrlGeneration:
    def _make_source(self, api_version: str):
        source = MagicMock()
        source.service_connection = MagicMock()
        source.service_connection.hostPort = "http://airflow.example.com:8080"
        source.connection = MagicMock()
        source.connection.api_version = api_version
        return source

    def test_v2_dag_url(self):
        source = self._make_source("v2")
        url = AirflowApiSource._get_dag_source_url(source, "my_dag")
        assert url == "http://airflow.example.com:8080/dags/my_dag"

    def test_v1_dag_url(self):
        source = self._make_source("v1")
        url = AirflowApiSource._get_dag_source_url(source, "my_dag")
        assert url == "http://airflow.example.com:8080/dags/my_dag/grid"

    def test_v2_task_url(self):
        source = self._make_source("v2")
        url = AirflowApiSource._get_task_source_url(source, "my_dag", "my_task")
        assert url == "http://airflow.example.com:8080/dags/my_dag/tasks/my_task"

    def test_v1_task_url(self):
        source = self._make_source("v1")
        url = AirflowApiSource._get_task_source_url(source, "my_dag", "my_task")
        assert "taskinstance/list" in url
        assert "_flt_3_dag_id=my_dag" in url
        assert "_flt_3_task_id=my_task" in url


# ── Pagination: DAGs ─────────────────────────────────────────────────────


class TestPaginateGetAllDags:
    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_single_page(self, mock_rest_cls):
        client, mock_rest = _make_client(mock_rest_cls)
        mock_rest.get.return_value = {
            "dags": [{"dag_id": "a"}, {"dag_id": "b"}],
            "total_entries": 2,
        }

        result = client.get_all_dags()
        assert len(result) == 2
        assert result[0]["dag_id"] == "a"
        assert mock_rest.get.call_count == 1

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_multiple_pages(self, mock_rest_cls):
        client, mock_rest = _make_client(mock_rest_cls)

        page1 = {
            "dags": [{"dag_id": f"dag_{i}"} for i in range(100)],
            "total_entries": 250,
        }
        page2 = {
            "dags": [{"dag_id": f"dag_{i}"} for i in range(100, 200)],
            "total_entries": 250,
        }
        page3 = {
            "dags": [{"dag_id": f"dag_{i}"} for i in range(200, 250)],
            "total_entries": 250,
        }
        mock_rest.get.side_effect = [page1, page2, page3]

        result = client.get_all_dags()
        assert len(result) == 250
        assert result[0]["dag_id"] == "dag_0"
        assert result[-1]["dag_id"] == "dag_249"
        assert mock_rest.get.call_count == 3

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_multiple_pages_without_total_entries(self, mock_rest_cls):
        client, mock_rest = _make_client(mock_rest_cls)

        page1 = {"dags": [{"dag_id": f"dag_{i}"} for i in range(100)]}
        page2 = {"dags": [{"dag_id": f"dag_{i}"} for i in range(100, 120)]}
        mock_rest.get.side_effect = [page1, page2]

        result = client.get_all_dags()

        assert len(result) == 120
        assert result[-1]["dag_id"] == "dag_119"
        assert mock_rest.get.call_count == 2

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_empty_response(self, mock_rest_cls):
        client, mock_rest = _make_client(mock_rest_cls)
        mock_rest.get.return_value = {"dags": [], "total_entries": 0}

        result = client.get_all_dags()
        assert result == []


# ── Pagination: Task Instances ───────────────────────────────────────────


class TestPaginateTaskInstances:
    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_single_page_task_instances(self, mock_rest_cls):
        client, mock_rest = _make_client(mock_rest_cls)
        mock_rest.get.return_value = {
            "task_instances": [
                {"task_id": "t1", "state": "success"},
                {"task_id": "t2", "state": "failed"},
            ],
            "total_entries": 2,
        }

        result = client.get_task_instances_for_run("dag1", "run1")
        assert len(result) == 2
        assert result[0].task_id == "t1"
        assert result[0].state == "success"
        assert result[1].task_id == "t2"
        assert result[1].state == "failed"

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_multi_page_task_instances(self, mock_rest_cls):
        client, mock_rest = _make_client(mock_rest_cls)

        page1 = {
            "task_instances": [
                {"task_id": f"t_{i}", "state": "success"} for i in range(100)
            ],
            "total_entries": 150,
        }
        page2 = {
            "task_instances": [
                {"task_id": f"t_{i}", "state": "success"} for i in range(100, 150)
            ],
            "total_entries": 150,
        }
        mock_rest.get.side_effect = [page1, page2]

        result = client.get_task_instances_for_run("big_dag", "run1")
        assert len(result) == 150
        assert result[0].task_id == "t_0"
        assert result[-1].task_id == "t_149"
        assert mock_rest.get.call_count == 2

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_task_instances_api_error_returns_empty(self, mock_rest_cls):
        client, mock_rest = _make_client(mock_rest_cls)
        mock_rest.get.side_effect = Exception("Connection refused")

        result = client.get_task_instances_for_run("dag1", "run1")
        assert result == []


# ── Auth & Connectivity Error Propagation ────────────────────────────────


class TestAuthErrorPropagation:
    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_401_is_raised_during_version_detection(self, mock_rest_cls):
        client, mock_rest = _make_client(mock_rest_cls, api_version="auto")
        response = MagicMock()
        response.status_code = 401
        mock_rest.get.side_effect = HTTPError(response=response)

        with pytest.raises(HTTPError):
            client._detect_api_version()

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_403_is_raised_during_version_detection(self, mock_rest_cls):
        client, mock_rest = _make_client(mock_rest_cls, api_version="auto")
        response = MagicMock()
        response.status_code = 403
        mock_rest.get.side_effect = HTTPError(response=response)

        with pytest.raises(HTTPError):
            client._detect_api_version()

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_404_falls_through_to_next_version(self, mock_rest_cls):
        client, mock_rest = _make_client(mock_rest_cls, api_version="auto")
        response_404 = MagicMock()
        response_404.status_code = 404

        def side_effect(path):
            if "/v2/" in path:
                raise HTTPError(response=response_404)
            return {"version": "2.9.0"}

        mock_rest.get.side_effect = side_effect
        assert client._detect_api_version() == "v1"

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_connection_error_is_raised(self, mock_rest_cls):
        client, mock_rest = _make_client(mock_rest_cls, api_version="auto")
        mock_rest.get.side_effect = RequestsConnectionError("Connection refused")

        with pytest.raises(RequestsConnectionError):
            client._detect_api_version()

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_timeout_error_is_raised(self, mock_rest_cls):
        client, mock_rest = _make_client(mock_rest_cls, api_version="auto")
        mock_rest.get.side_effect = TimeoutError("timed out")

        with pytest.raises(TimeoutError):
            client._detect_api_version()


# ── Tag Edge Cases ───────────────────────────────────────────────────────


class TestBuildDagDetailsTagEdgeCases:
    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_empty_tag_names_are_filtered(self, mock_rest_cls):
        client, mock_rest = _make_client(mock_rest_cls)
        mock_rest.get.return_value = {"tasks": []}

        dag_data = {
            "dag_id": "test_dag",
            "tags": [{"name": ""}, {"name": "valid_tag"}, {"name": None}],
        }
        result = client.build_dag_details(dag_data)
        assert result.tags == ["valid_tag"]

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_non_string_non_dict_tags_are_skipped(self, mock_rest_cls):
        client, mock_rest = _make_client(mock_rest_cls)
        mock_rest.get.return_value = {"tasks": []}

        dag_data = {
            "dag_id": "test_dag",
            "tags": [123, None, {"name": "good"}, True],
        }
        result = client.build_dag_details(dag_data)
        assert result.tags == ["good"]

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_string_tags_are_kept(self, mock_rest_cls):
        client, mock_rest = _make_client(mock_rest_cls)
        mock_rest.get.return_value = {"tasks": []}

        dag_data = {
            "dag_id": "test_dag",
            "tags": ["simple_string_tag", {"name": "dict_tag"}],
        }
        result = client.build_dag_details(dag_data)
        assert result.tags == ["simple_string_tag", "dict_tag"]


# ── Pipeline Status: Timestamp Fallback ──────────────────────────────────


class TestPipelineStatusTimestampFallback:
    def test_uses_execution_date_when_available(self):
        source, dag = _make_source_and_dag()
        exec_dt = datetime(2025, 1, 15, 12, 0)
        start_dt = datetime(2025, 1, 15, 12, 5)
        source.connection.get_dag_runs.return_value = [
            AirflowApiDagRun(
                dag_run_id="run_1",
                state="success",
                execution_date=exec_dt,
                start_date=start_dt,
            ),
        ]
        source.connection.get_task_instances_for_run.return_value = []

        results = list(AirflowApiSource.yield_pipeline_status(source, dag))
        assert len(results) == 1
        status = results[0].right.pipeline_status
        expected_ts = datetime_to_ts(exec_dt)
        assert status.timestamp.root == expected_ts

    def test_falls_back_to_start_date(self):
        source, dag = _make_source_and_dag()
        start_dt = datetime(2025, 1, 15, 12, 5)
        source.connection.get_dag_runs.return_value = [
            AirflowApiDagRun(
                dag_run_id="run_1",
                state="success",
                execution_date=None,
                start_date=start_dt,
            ),
        ]
        source.connection.get_task_instances_for_run.return_value = []

        results = list(AirflowApiSource.yield_pipeline_status(source, dag))
        assert len(results) == 1
        status = results[0].right.pipeline_status
        expected_ts = datetime_to_ts(start_dt)
        assert status.timestamp.root == expected_ts

    def test_falls_back_to_end_date(self):
        source, dag = _make_source_and_dag()
        end_dt = datetime(2025, 1, 15, 12, 10)
        source.connection.get_dag_runs.return_value = [
            AirflowApiDagRun(
                dag_run_id="run_1",
                state="success",
                execution_date=None,
                start_date=None,
                end_date=end_dt,
            ),
        ]
        source.connection.get_task_instances_for_run.return_value = []

        results = list(AirflowApiSource.yield_pipeline_status(source, dag))
        assert len(results) == 1
        status = results[0].right.pipeline_status
        expected_ts = datetime_to_ts(end_dt)
        assert status.timestamp.root == expected_ts

    def test_skips_run_with_no_timestamp(self):
        source, dag = _make_source_and_dag()
        source.connection.get_dag_runs.return_value = [
            AirflowApiDagRun(
                dag_run_id="run_no_ts",
                state="success",
                execution_date=None,
                start_date=None,
                end_date=None,
            ),
        ]
        source.connection.get_task_instances_for_run.return_value = []

        results = list(AirflowApiSource.yield_pipeline_status(source, dag))
        assert len(results) == 0


# ── Pipeline State ───────────────────────────────────────────────────────


class TestGetPipelineState:
    def test_paused_returns_inactive(self):
        source, _ = _make_source_and_dag()
        dag = AirflowApiDagDetails(dag_id="test", is_paused=True)
        result = AirflowApiSource.get_pipeline_state(source, dag)
        assert result == PipelineState.Inactive

    def test_not_paused_returns_active(self):
        source, _ = _make_source_and_dag()
        dag = AirflowApiDagDetails(dag_id="test", is_paused=False)
        result = AirflowApiSource.get_pipeline_state(source, dag)
        assert result == PipelineState.Active

    def test_none_paused_returns_none(self):
        source, _ = _make_source_and_dag()
        dag = AirflowApiDagDetails(dag_id="test", is_paused=None)
        result = AirflowApiSource.get_pipeline_state(source, dag)
        assert result is None


# ── Build Tasks ──────────────────────────────────────────────────────────


class TestBuildTasks:
    def test_builds_tasks_with_all_fields(self):
        source, dag = _make_source_and_dag()
        tasks = AirflowApiSource._build_tasks(source, dag)
        assert len(tasks) == 2

        t1 = tasks[0]
        assert t1.name == "task_1"
        assert t1.downstreamTasks == ["task_2"]
        assert t1.taskType == "PythonOperator"
        assert t1.description is not None
        assert "Task 1 docs" in t1.description.root

    def test_builds_tasks_with_none_class_ref(self):
        source, _ = _make_source_and_dag()
        dag = AirflowApiDagDetails(
            dag_id="test",
            tasks=[AirflowApiTask(task_id="t1", class_ref=None)],
        )
        tasks = AirflowApiSource._build_tasks(source, dag)
        assert len(tasks) == 1
        assert tasks[0].taskType is None

    def test_builds_tasks_empty(self):
        source, _ = _make_source_and_dag()
        dag = AirflowApiDagDetails(dag_id="test", tasks=[])
        tasks = AirflowApiSource._build_tasks(source, dag)
        assert tasks == []


# ── Yield Pipeline ───────────────────────────────────────────────────────


class TestYieldPipeline:
    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.source.get_tag_labels",
        return_value=[],
    )
    def test_yields_create_pipeline_request(self, _mock_tags):
        source, dag = _make_source_and_dag()
        results = list(AirflowApiSource.yield_pipeline(source, dag))

        assert len(results) == 1
        request = results[0].right
        assert request.name.root == "test_dag"
        assert request.description.root == "A test pipeline"
        assert request.scheduleInterval == "@daily"
        assert len(request.tasks) == 2
        assert request.tasks[0].name == "task_1"

    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.source.get_tag_labels",
        return_value=[],
    )
    def test_yields_error_on_exception(self, _mock_tags):
        source, dag = _make_source_and_dag()
        # Break the service name to trigger a validation error
        source.context.get.return_value.pipeline_service = None

        results = list(AirflowApiSource.yield_pipeline(source, dag))
        assert len(results) == 1
        assert results[0].left is not None
        assert "test_dag" in results[0].left.name


# ── Owner Resolution ─────────────────────────────────────────────────────


def _make_entity_ref(name, ref_type="user"):
    """Create a real EntityReference for testing."""
    import uuid

    return EntityReference(
        id=str(uuid.uuid4()),
        type=ref_type,
        name=name,
    )


class TestGetOwners:
    def _make_source(self):
        source = MagicMock()
        source.metadata = MagicMock()
        return source

    def test_returns_none_when_include_owners_disabled(self):
        source = self._make_source()
        source.source_config.includeOwners = False
        result = AirflowApiSource.get_owners(source, ["admin"])
        assert result is None
        source.metadata.get_reference_by_name.assert_not_called()

    def test_returns_none_for_none_owners(self):
        source = self._make_source()
        result = AirflowApiSource.get_owners(source, None)
        assert result is None

    def test_returns_none_for_empty_list(self):
        source = self._make_source()
        result = AirflowApiSource.get_owners(source, [])
        assert result is None

    def test_resolves_single_owner(self):
        source = self._make_source()
        admin_ref = _make_entity_ref("admin")
        source.metadata.get_reference_by_name.return_value = EntityReferenceList(
            root=[admin_ref]
        )

        result = AirflowApiSource.get_owners(source, ["admin"])
        assert result is not None
        assert len(result.root) == 1
        assert result.root[0].name == "admin"
        source.metadata.get_reference_by_name.assert_called_once_with(
            name="admin", is_owner=True
        )

    def test_resolves_multiple_owners(self):
        source = self._make_source()
        admin_ref = _make_entity_ref("admin")
        analyst_ref = _make_entity_ref("analyst")
        source.metadata.get_reference_by_name.side_effect = [
            EntityReferenceList(root=[admin_ref]),
            EntityReferenceList(root=[analyst_ref]),
        ]

        result = AirflowApiSource.get_owners(source, ["admin", "analyst"])
        assert result is not None
        assert len(result.root) == 2
        names = {r.name for r in result.root}
        assert names == {"admin", "analyst"}

    def test_skips_unresolved_owner(self):
        source = self._make_source()
        admin_ref = _make_entity_ref("admin")
        source.metadata.get_reference_by_name.side_effect = [
            EntityReferenceList(root=[admin_ref]),
            None,
        ]

        result = AirflowApiSource.get_owners(source, ["admin", "unknown_user"])
        assert result is not None
        assert len(result.root) == 1
        assert result.root[0].name == "admin"

    def test_returns_none_when_all_lookups_fail(self):
        source = self._make_source()
        source.metadata.get_reference_by_name.side_effect = Exception("ES down")

        result = AirflowApiSource.get_owners(source, ["admin"])
        assert result is None

    def test_partial_failure_returns_resolved_owners(self):
        source = self._make_source()
        admin_ref = _make_entity_ref("admin")

        def side_effect(name, is_owner):
            if name == "admin":
                return EntityReferenceList(root=[admin_ref])
            raise Exception(f"User {name} not found")

        source.metadata.get_reference_by_name.side_effect = side_effect

        result = AirflowApiSource.get_owners(source, ["admin", "bad_user"])
        assert result is not None
        assert len(result.root) == 1
        assert result.root[0].name == "admin"


# ── Yield Pipeline with Owners ───────────────────────────────────────────


class TestYieldPipelineOwners:
    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.source.get_tag_labels",
        return_value=[],
    )
    def test_owners_propagated_to_request(self, _mock_tags):
        source, dag = _make_source_and_dag()
        dag.owners = ["airflow_admin"]
        admin_ref = _make_entity_ref("airflow_admin")
        owner_list = EntityReferenceList(root=[admin_ref])
        source.get_owners = lambda owners: owner_list if owners else None

        results = list(AirflowApiSource.yield_pipeline(source, dag))
        assert len(results) == 1
        assert results[0].right.owners is not None
        assert len(results[0].right.owners.root) == 1

    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.source.get_tag_labels",
        return_value=[],
    )
    def test_no_owners_sets_none(self, _mock_tags):
        source, dag = _make_source_and_dag()
        dag.owners = None
        source.get_owners = lambda owners: None

        results = list(AirflowApiSource.yield_pipeline(source, dag))
        assert len(results) == 1
        assert results[0].right.owners is None

    @patch(
        "metadata.ingestion.source.pipeline.airflow.api.source.get_tag_labels",
        return_value=[],
    )
    def test_empty_owners_sets_none(self, _mock_tags):
        source, dag = _make_source_and_dag()
        dag.owners = []
        source.get_owners = lambda owners: None

        results = list(AirflowApiSource.yield_pipeline(source, dag))
        assert len(results) == 1
        assert results[0].right.owners is None


# ── Client: DAG Runs Parsing ─────────────────────────────────────────────


class TestClientGetDagRuns:
    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_parses_dag_runs_with_logical_date(self, mock_rest_cls):
        client, mock_rest = _make_client(mock_rest_cls)
        mock_rest.get.return_value = {
            "dag_runs": [
                {
                    "dag_run_id": "run_1",
                    "state": "success",
                    "logical_date": "2025-01-15T12:00:00+00:00",
                    "start_date": "2025-01-15T12:01:00+00:00",
                    "end_date": "2025-01-15T12:05:00+00:00",
                }
            ]
        }

        runs = client.get_dag_runs("my_dag", limit=5)
        assert len(runs) == 1
        assert runs[0].dag_run_id == "run_1"
        assert runs[0].state == "success"
        assert runs[0].execution_date is not None

    @patch("metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST")
    def test_returns_empty_on_api_error(self, mock_rest_cls):
        client, mock_rest = _make_client(mock_rest_cls)
        mock_rest.get.side_effect = Exception("API down")

        runs = client.get_dag_runs("my_dag")
        assert runs == []
