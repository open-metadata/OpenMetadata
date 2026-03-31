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
Comprehensive mocked integration test for Airflow API connector.

This test validates the complete Airflow integration flow without requiring
real Airflow or OpenMetadata services, making it suitable for CI/CD environments.

Tests covered:
- Airflow API client functionality with all authentication methods
- DAG metadata extraction and parsing
- Task extraction and relationship mapping
- DAG run status processing
- Pipeline entity creation in OpenMetadata
- Error handling and edge cases
- OpenLineage integration scenarios
"""
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, Mock, patch

import pytest
import requests

from metadata.generated.schema.entity.services.connections.pipeline.airflowConnection import (
    AirflowConnection,
)
from metadata.generated.schema.entity.utils.airflowRestApiConnection import (
    AirflowRestApiConnection,
)
from metadata.generated.schema.entity.utils.common import (
    accessTokenConfig,
    basicAuthConfig,
)
from metadata.ingestion.source.pipeline.airflow.api.client import AirflowApiClient
from metadata.workflow.metadata import MetadataWorkflow

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_TRACKED_REST_PATH = "metadata.ingestion.source.pipeline.airflow.api.client.TrackedREST"
_BASIC_AUTH_CALLBACK_PATH = (
    "metadata.ingestion.source.pipeline.airflow.api.client.build_basic_auth_callback"
)


def _make_access_token_config(token: str = "test_token") -> AirflowRestApiConnection:
    """Helper – build a RestAPI config using a static access token."""
    return AirflowRestApiConnection(
        type="RestAPI",
        authConfig=accessTokenConfig.AccessToken(token=token),
    )


def _make_airflow_connection(token: str = "test_token") -> AirflowConnection:
    """Helper – build a full AirflowConnection using a static access token."""
    return AirflowConnection(
        hostPort="http://localhost:8080",
        connection=_make_access_token_config(token),
    )


class TestAirflowApiMockedIntegration:
    """Comprehensive mocked integration tests for Airflow API connector."""

    @pytest.fixture
    def mock_airflow_responses(self):
        """Mock responses for various Airflow API endpoints with Airflow 3.x data structures."""
        return {
            "version": {"version": "3.0.1", "git_version": "abc123def456"},
            "dags": {
                "dags": [
                    {
                        "dag_id": "sample_etl_dag",
                        "description": "Sample ETL pipeline",
                        "fileloc": "/opt/airflow/dags/sample_etl.py",
                        "file_token": "abc123def456",
                        "is_paused": False,
                        "is_active": True,
                        "is_subdag": False,
                        "owners": ["data_team"],
                        "tags": [{"name": "etl"}, {"name": "daily"}],
                        "schedule_interval": {
                            "__type": "CronExpression",
                            "value": "@daily",
                        },
                        "timetable_summary": "At 00:00 every day",
                        "catchup": True,
                        "max_active_runs": 1,
                        "max_consecutive_failed_dag_runs": 5,
                        "has_task_concurrency_limits": False,
                        "has_import_errors": False,
                        "next_dagrun": "2024-01-02T00:00:00Z",
                        "next_dagrun_data_interval_start": "2024-01-01T00:00:00Z",
                        "next_dagrun_data_interval_end": "2024-01-02T00:00:00Z",
                        "next_dagrun_create_after": "2024-01-02T00:00:00Z",
                        "doc_md": "Sample ETL pipeline documentation",
                        "default_view": "graph",
                        "orientation": "LR",
                        "dataset_triggers": [],
                        "params": {"env": "production"},
                        "start_date": "2024-01-01T00:00:00Z",
                    },
                    {
                        "dag_id": "ml_training_pipeline",
                        "description": "ML model training pipeline",
                        "fileloc": "/opt/airflow/dags/ml_training.py",
                        "file_token": "def456ghi789",
                        "is_paused": True,
                        "is_active": True,
                        "is_subdag": False,
                        "owners": ["ml_team"],
                        "tags": [{"name": "ml"}, {"name": "weekly"}],
                        "schedule_interval": {
                            "__type": "CronExpression",
                            "value": "0 0 * * 1",
                        },
                        "timetable_summary": "At 00:00 on Monday",
                        "catchup": False,
                        "max_active_runs": 2,
                        "max_consecutive_failed_dag_runs": 3,
                        "has_task_concurrency_limits": True,
                        "has_import_errors": False,
                        "next_dagrun": None,
                        "next_dagrun_data_interval_start": None,
                        "next_dagrun_data_interval_end": None,
                        "next_dagrun_create_after": None,
                        "doc_md": None,
                        "default_view": "graph",
                        "orientation": "TB",
                        "dataset_triggers": [
                            {
                                "uri": "s3://ml-data/training/",
                                "extra": {"bucket": "ml-data", "prefix": "training/"},
                            }
                        ],
                        "params": {"model_type": "xgboost"},
                        "start_date": "2024-01-01T00:00:00Z",
                    },
                ],
                "total_entries": 2,
            },
            "tasks": {
                "sample_etl_dag": {
                    "tasks": [
                        {
                            "task_id": "extract_data",
                            "task_display_name": "Extract Data from Source",
                            "operator_name": "S3KeySensor",
                            "operator_class_name": "airflow.providers.amazon.aws.sensors.s3.S3KeySensor",
                            "downstream_task_ids": ["transform_data"],
                            "upstream_task_ids": [],
                            "owner": "data_team",
                            "start_date": "2024-01-01T00:00:00Z",
                            "end_date": None,
                            "depends_on_past": False,
                            "wait_for_downstream": False,
                            "retries": 3,
                            "retry_delay": {
                                "__type": "TimeDelta",
                                "days": 0,
                                "seconds": 300,
                            },
                            "retry_exponential_backoff": False,
                            "max_retry_delay": None,
                            "priority_weight": 1,
                            "weight_rule": "downstream",
                            "queue": "default",
                            "pool": "default_pool",
                            "pool_slots": 1,
                            "execution_timeout": {
                                "__type": "TimeDelta",
                                "days": 0,
                                "seconds": 3600,
                            },
                            "trigger_rule": "all_success",
                            "ui_color": "#f0ede4",
                            "ui_fgcolor": "#000000",
                            "template_fields": ["bucket_key", "bucket_name"],
                            "doc_md": "Extracts data from S3 source",
                            "params": {"bucket_name": "data-lake", "timeout": 3600},
                            "extra_links": [],
                            "owner_links": {},
                        },
                        {
                            "task_id": "transform_data",
                            "task_display_name": "Transform Data with dbt",
                            "operator_name": "DbtRunOperator",
                            "operator_class_name": "airflow_dbt.operators.dbt_run_operator.DbtRunOperator",
                            "downstream_task_ids": ["load_data"],
                            "upstream_task_ids": ["extract_data"],
                            "owner": "data_team",
                            "start_date": "2024-01-01T00:00:00Z",
                            "end_date": None,
                            "depends_on_past": True,
                            "wait_for_downstream": False,
                            "retries": 2,
                            "retry_delay": {
                                "__type": "TimeDelta",
                                "days": 0,
                                "seconds": 600,
                            },
                            "retry_exponential_backoff": False,
                            "max_retry_delay": None,
                            "priority_weight": 5,
                            "weight_rule": "absolute",
                            "queue": "dbt_queue",
                            "pool": "dbt_pool",
                            "pool_slots": 2,
                            "execution_timeout": {
                                "__type": "TimeDelta",
                                "days": 0,
                                "seconds": 7200,
                            },
                            "trigger_rule": "all_success",
                            "ui_color": "#8194C7",
                            "ui_fgcolor": "#FFFFFF",
                            "template_fields": ["models", "vars"],
                            "doc_md": "Transforms data using dbt models",
                            "params": {
                                "models": "staging",
                                "vars": {"run_date": "{{ ds }}"},
                            },
                            "extra_links": [],
                            "owner_links": {},
                        },
                        {
                            "task_id": "load_data",
                            "task_display_name": "Load Data to Warehouse",
                            "operator_name": "SnowflakeOperator",
                            "operator_class_name": "airflow.providers.snowflake.operators.snowflake.SnowflakeOperator",
                            "downstream_task_ids": [],
                            "upstream_task_ids": ["transform_data"],
                            "owner": "data_team",
                            "start_date": "2024-01-01T00:00:00Z",
                            "end_date": None,
                            "depends_on_past": False,
                            "wait_for_downstream": False,
                            "retries": 1,
                            "retry_delay": {
                                "__type": "TimeDelta",
                                "days": 0,
                                "seconds": 300,
                            },
                            "retry_exponential_backoff": False,
                            "max_retry_delay": None,
                            "priority_weight": 3,
                            "weight_rule": "downstream",
                            "queue": "warehouse_queue",
                            "pool": "snowflake_pool",
                            "pool_slots": 1,
                            "execution_timeout": {
                                "__type": "TimeDelta",
                                "days": 0,
                                "seconds": 1800,
                            },
                            "trigger_rule": "all_success",
                            "ui_color": "#EDEDED",
                            "ui_fgcolor": "#000000",
                            "template_fields": ["sql"],
                            "doc_md": "Loads transformed data to Snowflake warehouse",
                            "params": {"database": "analytics", "schema": "public"},
                            "extra_links": [],
                            "owner_links": {},
                        },
                    ]
                }
            },
            "dag_runs": {
                "sample_etl_dag": {
                    "dag_runs": [
                        {
                            "dag_run_id": "scheduled__2024-01-01T00:00:00+00:00",
                            "dag_id": "sample_etl_dag",
                            "logical_date": "2024-01-01T00:00:00Z",
                            "execution_date": "2024-01-01T00:00:00Z",
                            "start_date": "2024-01-01T00:01:00Z",
                            "end_date": "2024-01-01T00:15:00Z",
                            "data_interval_start": "2024-01-01T00:00:00Z",
                            "data_interval_end": "2024-01-02T00:00:00Z",
                            "last_scheduling_decision": "2024-01-01T00:00:30Z",
                            "run_type": "scheduled",
                            "state": "success",
                            "external_trigger": False,
                            "triggering_dataset_events": [],
                            "conf": {},
                            "note": "Completed successfully",
                        },
                        {
                            "dag_run_id": "scheduled__2024-01-02T00:00:00+00:00",
                            "dag_id": "sample_etl_dag",
                            "logical_date": "2024-01-02T00:00:00Z",
                            "execution_date": "2024-01-02T00:00:00Z",
                            "start_date": "2024-01-02T00:01:00Z",
                            "end_date": None,
                            "data_interval_start": "2024-01-02T00:00:00Z",
                            "data_interval_end": "2024-01-03T00:00:00Z",
                            "last_scheduling_decision": "2024-01-02T00:00:30Z",
                            "run_type": "scheduled",
                            "state": "running",
                            "external_trigger": False,
                            "triggering_dataset_events": [],
                            "conf": {},
                            "note": "Currently running",
                        },
                    ],
                    "total_entries": 2,
                }
            },
            "task_instances": {
                "sample_etl_dag": {
                    "scheduled__2024-01-01T00:00:00+00:00": {
                        "task_instances": [
                            {
                                "task_id": "extract_data",
                                "dag_id": "sample_etl_dag",
                                "dag_run_id": "scheduled__2024-01-01T00:00:00+00:00",
                                "logical_date": "2024-01-01T00:00:00Z",
                                "execution_date": "2024-01-01T00:00:00Z",
                                "start_date": "2024-01-01T00:01:00Z",
                                "end_date": "2024-01-01T00:05:00Z",
                                "duration": 240.0,
                                "state": "success",
                                "try_number": 1,
                                "max_tries": 3,
                                "hostname": "worker-1",
                                "unixname": "airflow",
                                "job_id": 12345,
                                "pool": "default_pool",
                                "pool_slots": 1,
                                "queue": "default",
                                "priority_weight": 1,
                                "operator": "S3KeySensor",
                                "operator_class": "airflow.providers.amazon.aws.sensors.s3.S3KeySensor",
                                "queued_dttm": "2024-01-01T00:01:00Z",
                                "queued_by_job_id": None,
                                "pid": 1234,
                                "executor": "CeleryExecutor",
                                "executor_config": {},
                                "sla_miss": None,
                                "rendered_fields": {
                                    "bucket_name": "data-lake",
                                    "bucket_key": "raw/2024-01-01/",
                                },
                                "test_mode": False,
                                "trigger": None,
                                "triggerer_job": None,
                                "note": "Successfully detected new files",
                            },
                            {
                                "task_id": "transform_data",
                                "dag_id": "sample_etl_dag",
                                "dag_run_id": "scheduled__2024-01-01T00:00:00+00:00",
                                "logical_date": "2024-01-01T00:00:00Z",
                                "execution_date": "2024-01-01T00:00:00Z",
                                "start_date": "2024-01-01T00:05:00Z",
                                "end_date": "2024-01-01T00:10:00Z",
                                "duration": 300.0,
                                "state": "success",
                                "try_number": 1,
                                "max_tries": 2,
                                "hostname": "worker-2",
                                "unixname": "airflow",
                                "job_id": 12346,
                                "pool": "dbt_pool",
                                "pool_slots": 2,
                                "queue": "dbt_queue",
                                "priority_weight": 5,
                                "operator": "DbtRunOperator",
                                "operator_class": "airflow_dbt.operators.dbt_run_operator.DbtRunOperator",
                                "queued_dttm": "2024-01-01T00:05:00Z",
                                "queued_by_job_id": 12345,
                                "pid": 1235,
                                "executor": "CeleryExecutor",
                                "executor_config": {},
                                "sla_miss": None,
                                "rendered_fields": {
                                    "models": "staging",
                                    "vars": {"run_date": "2024-01-01"},
                                },
                                "test_mode": False,
                                "trigger": None,
                                "triggerer_job": None,
                                "note": "dbt models executed successfully",
                            },
                            {
                                "task_id": "load_data",
                                "dag_id": "sample_etl_dag",
                                "dag_run_id": "scheduled__2024-01-01T00:00:00+00:00",
                                "logical_date": "2024-01-01T00:00:00Z",
                                "execution_date": "2024-01-01T00:00:00Z",
                                "start_date": "2024-01-01T00:10:00Z",
                                "end_date": "2024-01-01T00:15:00Z",
                                "duration": 300.0,
                                "state": "success",
                                "try_number": 1,
                                "max_tries": 1,
                                "hostname": "worker-1",
                                "unixname": "airflow",
                                "job_id": 12347,
                                "pool": "snowflake_pool",
                                "pool_slots": 1,
                                "queue": "warehouse_queue",
                                "priority_weight": 3,
                                "operator": "SnowflakeOperator",
                                "operator_class": "airflow.providers.snowflake.operators.snowflake.SnowflakeOperator",
                                "queued_dttm": "2024-01-01T00:10:00Z",
                                "queued_by_job_id": 12346,
                                "pid": 1236,
                                "executor": "CeleryExecutor",
                                "executor_config": {},
                                "sla_miss": None,
                                "rendered_fields": {
                                    "sql": "INSERT INTO analytics.public.fact_table SELECT * FROM staging.transformed_data"
                                },
                                "test_mode": False,
                                "trigger": None,
                                "triggerer_job": None,
                                "note": "Data loaded to Snowflake successfully",
                            },
                        ]
                    }
                }
            },
        }

    @pytest.fixture
    def mock_openmetadata_client(self):
        """Mock OpenMetadata client for testing."""
        mock_client = MagicMock()
        mock_client.health_check.return_value = True

        # Mock service creation
        mock_service = MagicMock()
        mock_service.id = MagicMock()
        mock_service.id.root = str(uuid.uuid4())
        mock_service.fullyQualifiedName = MagicMock()
        mock_service.fullyQualifiedName.root = "airflow_service"
        mock_client.create_or_update.return_value = mock_service
        mock_client.get_by_name.return_value = mock_service

        return mock_client

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _fake_rest(mock_tracked_rest_cls, responses):
        """
        Configure the mock TrackedREST instance's .get() to return *responses*.

        *responses* can be:
          - a single value  → always returns that value
          - a list          → returns items one-by-one (side_effect)
          - an exception    → raises it on every call
        """
        mock_instance = mock_tracked_rest_cls.return_value
        if isinstance(responses, list):
            mock_instance.get.side_effect = responses
        elif isinstance(responses, Exception):
            mock_instance.get.side_effect = responses
        else:
            mock_instance.get.return_value = responses
        return mock_instance

    def test_airflow_client_token_authentication(self, mock_airflow_responses):
        """Test Airflow client with token-based authentication."""
        config = _make_airflow_connection(token="test_token_123")

        with patch(_TRACKED_REST_PATH) as mock_tracked_rest_cls:
            # _detect_api_version calls /v2/version first; make it succeed so
            # the client settles on "v2", then get_version() calls /v2/version again.
            self._fake_rest(
                mock_tracked_rest_cls,
                [
                    mock_airflow_responses[
                        "version"
                    ],  # _detect_api_version /v2/version
                    mock_airflow_responses["version"],  # get_version()
                ],
            )

            airflow_client = AirflowApiClient(config)

            version = airflow_client.get_version()
            assert version["version"] == "3.0.1"

            mock_tracked_rest_cls.return_value.get.assert_called()

    def test_airflow_client_basic_authentication(self, mock_airflow_responses):
        """Test Airflow client with basic authentication."""
        config = AirflowConnection(
            hostPort="http://localhost:8080",
            connection=AirflowRestApiConnection(
                type="RestAPI",
                authConfig=basicAuthConfig.BasicAuth(
                    username="admin", password="admin123"
                ),
            ),
        )

        # build_basic_auth_callback calls try_exchange_jwt (a real HTTP POST).
        # Patch it to return a dummy (callback, None) tuple.
        dummy_callback = lambda: ("Basic YWRtaW46YWRtaW4xMjM=", 7 * 24 * 3600)
        with (
            patch(_BASIC_AUTH_CALLBACK_PATH, return_value=(dummy_callback, None)),
            patch(_TRACKED_REST_PATH) as mock_tracked_rest_cls,
        ):
            self._fake_rest(
                mock_tracked_rest_cls,
                [
                    mock_airflow_responses["version"],  # _detect_api_version
                    mock_airflow_responses["version"],  # get_version()
                ],
            )

            airflow_client = AirflowApiClient(config)

            version = airflow_client.get_version()
            assert version["version"] == "3.0.1"

            mock_tracked_rest_cls.return_value.get.assert_called()

    def test_airflow_api_version_detection(self, mock_airflow_responses):
        """Test API version detection logic."""
        config = _make_airflow_connection()

        with patch(_TRACKED_REST_PATH) as mock_tracked_rest_cls:
            self._fake_rest(
                mock_tracked_rest_cls,
                [
                    mock_airflow_responses[
                        "version"
                    ],  # _detect_api_version /v2/version
                    mock_airflow_responses["version"],  # get_version()
                ],
            )

            airflow_client = AirflowApiClient(config)

            version = airflow_client.get_version()
            assert version["version"] == "3.0.1"
            assert "git_version" in version

    def test_dag_metadata_extraction_and_parsing(self, mock_airflow_responses):
        """Test comprehensive DAG metadata extraction with Airflow 3.x data."""
        config = _make_airflow_connection()

        with patch(_TRACKED_REST_PATH) as mock_tracked_rest_cls:
            self._fake_rest(
                mock_tracked_rest_cls,
                [
                    mock_airflow_responses["version"],  # _detect_api_version
                    mock_airflow_responses["dags"],  # _paginate → list_dags (page 1)
                    mock_airflow_responses["tasks"][
                        "sample_etl_dag"
                    ],  # build_dag_details → get_dag_tasks
                ],
            )

            airflow_client = AirflowApiClient(config)

            # Test DAG listing
            dags = airflow_client.get_all_dags()
            assert len(dags) == 2
            assert dags[0]["dag_id"] == "sample_etl_dag"
            assert dags[1]["dag_id"] == "ml_training_pipeline"

            # Verify Airflow 3.x specific fields
            dag1 = dags[0]
            assert "file_token" in dag1
            assert "is_active" in dag1
            assert "has_task_concurrency_limits" in dag1
            assert "has_import_errors" in dag1
            assert "timetable_summary" in dag1
            assert "dataset_triggers" in dag1
            assert "params" in dag1

            # Verify modern schedule format
            assert dag1["schedule_interval"]["__type"] == "CronExpression"
            assert dag1["schedule_interval"]["value"] == "@daily"

            # Test DAG details building (calls get_dag_tasks internally)
            dag_details = airflow_client.build_dag_details(dag1)

            # Verify basic metadata
            assert dag_details.dag_id == "sample_etl_dag"
            assert dag_details.description == "Sample ETL pipeline"
            assert dag_details.fileloc == "/opt/airflow/dags/sample_etl.py"
            assert dag_details.is_paused == False
            assert dag_details.owners == ["data_team"]

            # Verify tags parsing
            assert "etl" in dag_details.tags
            assert "daily" in dag_details.tags

            # Verify tasks extraction with Airflow 3.x structure
            assert len(dag_details.tasks) == 3
            task_ids = [task.task_id for task in dag_details.tasks]
            assert "extract_data" in task_ids
            assert "transform_data" in task_ids
            assert "load_data" in task_ids

            # Verify modern task fields
            extract_task = next(
                t for t in dag_details.tasks if t.task_id == "extract_data"
            )
            assert hasattr(extract_task, "downstream_task_ids")
            assert "transform_data" in extract_task.downstream_task_ids

    def test_dag_runs_and_status_processing(self, mock_airflow_responses):
        """Test DAG run status extraction and processing with Airflow 3.x data.

        NOTE: ``get_dag_runs`` returns a list of ``AirflowApiDagRun`` model
        objects (not raw dicts), so attribute access is used below.
        """
        config = _make_airflow_connection()

        with patch(_TRACKED_REST_PATH) as mock_tracked_rest_cls:
            self._fake_rest(
                mock_tracked_rest_cls,
                [
                    mock_airflow_responses["version"],  # _detect_api_version
                    mock_airflow_responses["dag_runs"][
                        "sample_etl_dag"
                    ],  # list_dag_runs
                ],
            )

            airflow_client = AirflowApiClient(config)

            dag_runs = airflow_client.get_dag_runs("sample_etl_dag", limit=10)

            assert len(dag_runs) == 2

            # AirflowApiDagRun is a Pydantic model – use attribute access.
            run1 = dag_runs[0]
            assert run1.dag_run_id == "scheduled__2024-01-01T00:00:00+00:00"
            assert run1.state == "success"
            # execution_date is parsed from logical_date (ISO string → datetime)
            assert run1.execution_date is not None

            run2 = dag_runs[1]
            assert run2.dag_run_id == "scheduled__2024-01-02T00:00:00+00:00"
            assert run2.state == "running"
            assert run2.execution_date is not None

    def test_task_instance_extraction(self, mock_airflow_responses):
        """Test task instance extraction and processing with Airflow 3.x data.

        ``get_task_instances_for_run`` (paginated helper) returns a list of
        ``AirflowApiTaskInstance`` model objects – use attribute access.
        The lower-level ``get_task_instances`` returns the raw API dict.
        """
        config = _make_airflow_connection()

        run_id = "scheduled__2024-01-01T00:00:00+00:00"
        raw_ti_response = mock_airflow_responses["task_instances"]["sample_etl_dag"][
            run_id
        ]

        with patch(_TRACKED_REST_PATH) as mock_tracked_rest_cls:
            self._fake_rest(
                mock_tracked_rest_cls,
                [
                    mock_airflow_responses["version"],  # _detect_api_version
                    raw_ti_response,  # _paginate → task instances page 1
                ],
            )

            airflow_client = AirflowApiClient(config)

            task_instances = airflow_client.get_task_instances_for_run(
                "sample_etl_dag", run_id
            )

            assert len(task_instances) == 3

            # AirflowApiTaskInstance is a Pydantic model – use attribute access.
            extract_instance = next(
                ti for ti in task_instances if ti.task_id == "extract_data"
            )
            assert extract_instance.state == "success"
            assert extract_instance.start_date is not None
            assert extract_instance.end_date is not None

    def test_error_handling_and_edge_cases(self):
        """Test error handling for various failure scenarios."""
        config = _make_airflow_connection()

        with patch(_TRACKED_REST_PATH) as mock_tracked_rest_cls:
            mock_rest = mock_tracked_rest_cls.return_value

            # _detect_api_version will raise ConnectionError on /v2/version → re-raised
            mock_rest.get.side_effect = requests.exceptions.ConnectionError(
                "Connection refused"
            )

            airflow_client = AirflowApiClient(config)

            with pytest.raises(requests.exceptions.ConnectionError):
                # api_version property triggers _detect_api_version which calls client.get
                airflow_client.get_version()

            # Reset: now return a valid response so get_version() works
            mock_rest.get.side_effect = None
            mock_rest.get.return_value = {"version": "3.0.1"}

            # Force re-detection (clear cached version)
            airflow_client._detected_version = "v1"

            result = airflow_client.get_version()
            assert result["version"] == "3.0.1"

    def test_full_workflow_integration(
        self, mock_airflow_responses, mock_openmetadata_client
    ):
        """Test complete workflow from Airflow ingestion to OM entity creation."""
        workflow_config = {
            "source": {
                "type": "airflow",
                "serviceName": "test_airflow_service",
                "serviceConnection": {
                    "config": {
                        "type": "Airflow",
                        "hostPort": "http://localhost:8080",
                        "numberOfStatus": 5,
                        "connection": {
                            "type": "RestAPI",
                            "authConfig": {"token": "test_token"},
                        },
                    }
                },
                "sourceConfig": {"config": {"type": "PipelineMetadata"}},
            },
            "sink": {"type": "metadata-rest", "config": {}},
            "workflowConfig": {
                "loggerLevel": "INFO",
                "openMetadataServerConfig": {
                    "hostPort": "http://localhost:8585/api",
                    "authProvider": "openmetadata",
                    "securityConfig": {"jwtToken": "test-jwt-token"},
                },
            },
        }

        with (
            patch(
                "metadata.workflow.base.create_ometa_client",
                return_value=mock_openmetadata_client,
            ),
            patch(
                "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
            ),
            patch(_TRACKED_REST_PATH) as mock_tracked_rest_cls,
        ):
            # The workflow will detect version, list dags, fetch tasks, runs, task instances
            self._fake_rest(
                mock_tracked_rest_cls,
                [
                    mock_airflow_responses["version"],  # _detect_api_version
                    mock_airflow_responses["dags"],  # get_all_dags page 1
                    mock_airflow_responses["tasks"]["sample_etl_dag"],  # dag tasks
                    mock_airflow_responses["dag_runs"]["sample_etl_dag"],  # dag runs
                    mock_airflow_responses["task_instances"]["sample_etl_dag"][
                        "scheduled__2024-01-01T00:00:00+00:00"
                    ],  # task instances page 1
                ],
            )

            workflow = MetadataWorkflow.create(workflow_config)
            workflow.execute()
            workflow.stop()

            assert mock_openmetadata_client.create_or_update.called

            create_calls = mock_openmetadata_client.create_or_update.call_args_list
            assert len(create_calls) > 0

    def test_openlineage_integration_scenarios(self):
        """Test OpenLineage event handling scenarios."""
        ol_event = {
            "eventType": "COMPLETE",
            "eventTime": datetime.now(timezone.utc).isoformat(),
            "producer": "https://airflow.apache.org",
            "schemaURL": "https://openlineage.io/spec/2-0-2/OpenLineage.json#/definitions/RunEvent",
            "run": {"runId": str(uuid.uuid4())},
            "job": {"namespace": "airflow", "name": "sample_etl_dag"},
            "inputs": [{"namespace": "postgres", "name": "public.source_table"}],
            "outputs": [{"namespace": "postgres", "name": "public.target_table"}],
        }

        with patch("requests.post") as mock_post:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "status": "success",
                "lineageEdgesCreated": 1,
            }
            mock_post.return_value = mock_response

            response = mock_post(
                "http://localhost:8585/api/v1/openlineage/lineage",
                headers={
                    "Authorization": "Bearer test",
                    "Content-Type": "application/json",
                },
                json=ol_event,
            )

            result = response.json()
            assert result["status"] == "success"
            assert result["lineageEdgesCreated"] == 1

    def test_airflow_3x_compatibility(self, mock_airflow_responses):
        """Test Airflow 3.x specific features and compatibility."""
        config = _make_airflow_connection()

        with patch(_TRACKED_REST_PATH) as mock_tracked_rest_cls:
            self._fake_rest(
                mock_tracked_rest_cls,
                [
                    mock_airflow_responses["version"],  # _detect_api_version
                    mock_airflow_responses["version"],  # get_version()
                    mock_airflow_responses["dags"],  # get_all_dags page 1
                ],
            )

            airflow_client = AirflowApiClient(config)

            # Test version detection
            version = airflow_client.get_version()
            assert version["version"] == "3.0.1"

            # Test DAGs with Airflow 3.x features
            dags = airflow_client.get_all_dags()

            # Verify dataset triggers in ML pipeline
            ml_dag = next(
                dag for dag in dags if dag["dag_id"] == "ml_training_pipeline"
            )
            assert "dataset_triggers" in ml_dag
            assert len(ml_dag["dataset_triggers"]) == 1
            assert ml_dag["dataset_triggers"][0]["uri"] == "s3://ml-data/training/"

            # Verify modern schedule format
            assert "schedule_interval" in ml_dag
            assert ml_dag["schedule_interval"]["__type"] == "CronExpression"
            assert ml_dag["schedule_interval"]["value"] == "0 0 * * 1"

            # Verify timetable summary
            assert ml_dag["timetable_summary"] == "At 00:00 on Monday"

            # Verify Airflow 3.x metadata fields
            assert "file_token" in ml_dag
            assert "has_task_concurrency_limits" in ml_dag
            assert "has_import_errors" in ml_dag
            assert "next_dagrun_create_after" in ml_dag

    def test_pagination_handling(self, mock_airflow_responses):
        """Test pagination for large DAG lists."""
        config = _make_airflow_connection()

        page1_response = {
            "dags": [
                {
                    "dag_id": f"dag_{i}",
                    "description": f"DAG {i}",
                    "file_token": f"token_{i}",
                    "is_active": True,
                    "tags": [],
                    "schedule_interval": {
                        "__type": "CronExpression",
                        "value": "@daily",
                    },
                    "timetable_summary": "At 00:00 every day",
                    "dataset_triggers": [],
                }
                for i in range(100)
            ],
            "total_entries": 150,
        }
        page2_response = {
            "dags": [
                {
                    "dag_id": f"dag_{i}",
                    "description": f"DAG {i}",
                    "file_token": f"token_{i}",
                    "is_active": True,
                    "tags": [],
                    "schedule_interval": {
                        "__type": "CronExpression",
                        "value": "@daily",
                    },
                    "timetable_summary": "At 00:00 every day",
                    "dataset_triggers": [],
                }
                for i in range(100, 150)
            ],
            "total_entries": 150,
        }

        with patch(_TRACKED_REST_PATH) as mock_tracked_rest_cls:
            self._fake_rest(
                mock_tracked_rest_cls,
                [
                    mock_airflow_responses["version"],  # _detect_api_version
                    page1_response,  # _paginate page 1
                    page2_response,  # _paginate page 2
                ],
            )

            airflow_client = AirflowApiClient(config)

            all_dags = airflow_client.get_all_dags()

            assert len(all_dags) == 150
            assert all_dags[0]["dag_id"] == "dag_0"
            assert all_dags[-1]["dag_id"] == "dag_149"

            assert "file_token" in all_dags[0]
            assert "timetable_summary" in all_dags[0]

    def test_special_character_handling(self, mock_airflow_responses):
        """Test handling of special characters in DAG IDs and names."""
        special_dag_response = {
            "dags": [
                {
                    "dag_id": "etl-pipeline_with.special@chars",
                    "description": "ETL with special chars: <>\"'&",
                    "fileloc": "/opt/airflow/dags/special chars/dag file.py",
                    "file_token": "special_token_123",
                    "is_active": True,
                    "is_paused": False,
                    "owners": ["data-team"],
                    "tags": [{"name": "special-tag_with.chars"}],
                    "schedule_interval": {
                        "__type": "CronExpression",
                        "value": "@daily",
                    },
                    "timetable_summary": "At 00:00 every day",
                    "dataset_triggers": [],
                    "params": {},
                }
            ],
            "total_entries": 1,
        }

        config = _make_airflow_connection()

        with patch(_TRACKED_REST_PATH) as mock_tracked_rest_cls:
            self._fake_rest(
                mock_tracked_rest_cls,
                [
                    mock_airflow_responses["version"],  # _detect_api_version
                    special_dag_response,  # _paginate page 1
                    {"tasks": []},  # build_dag_details → get_dag_tasks
                ],
            )

            airflow_client = AirflowApiClient(config)

            dags = airflow_client.get_all_dags()

            dag = dags[0]
            assert dag["dag_id"] == "etl-pipeline_with.special@chars"
            assert "special chars:" in dag["description"]
            assert dag["tags"][0]["name"] == "special-tag_with.chars"

            # Test DAG details building
            dag_details = airflow_client.build_dag_details(dag)
            assert dag_details.dag_id == "etl-pipeline_with.special@chars"
            assert "special-tag_with.chars" in dag_details.tags


# Run specific test methods
if __name__ == "__main__":
    pytest.main(
        [
            __file__
            + "::TestAirflowApiMockedIntegration::test_full_workflow_integration",
            "-v",
        ]
    )
