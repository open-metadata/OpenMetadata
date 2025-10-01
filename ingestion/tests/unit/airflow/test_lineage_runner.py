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
Test lineage runner date serialization
"""
from datetime import datetime, timezone
from unittest.mock import Mock, patch

import pytest

try:
    from airflow import DAG
    from airflow.operators.bash import BashOperator
except ImportError:
    pytest.skip("Airflow dependencies not installed", allow_module_level=True)

from airflow_provider_openmetadata.lineage.runner import AirflowLineageRunner
from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.utils.helpers import datetime_to_ts


def test_pipeline_startdate_uses_timestamp():
    """
    Test that pipeline startDate is converted to Unix epoch milliseconds timestamp,
    not ISO string format, to avoid Java deserialization errors during PATCH operations.

    Issue: https://github.com/open-metadata/OpenMetadata/issues/19125
    """
    # Create a DAG with a specific start date
    test_start_date = datetime(2023, 5, 9, 0, 0, 0, tzinfo=timezone.utc)
    expected_timestamp = datetime_to_ts(test_start_date)

    dag = DAG(
        dag_id="test_dag",
        start_date=test_start_date,
        description="Test DAG for date serialization",
        max_active_tasks=1,
        fileloc="/path/to/dag.py",
    )

    # Add a task to the DAG
    task = BashOperator(
        task_id="test_task",
        bash_command="echo 'test'",
        dag=dag,
        start_date=test_start_date,
    )

    # Create mock metadata client
    mock_metadata = Mock()
    mock_metadata.get_by_name.return_value = None  # Pipeline doesn't exist yet

    # Create mock pipeline service
    mock_service = Mock(spec=PipelineService)
    mock_service.fullyQualifiedName = "test_service"

    # Create the runner with mock metadata client
    with patch("airflow_provider_openmetadata.lineage.runner.conf") as mock_conf:
        mock_conf.get.return_value = "http://localhost:8080"
        runner = AirflowLineageRunner(
            metadata=mock_metadata,
            service_name="test_service",
            dag=dag,
        )

        # Mock the FQN build function
        with patch("airflow_provider_openmetadata.lineage.runner.fqn") as mock_fqn:
            mock_fqn.build.return_value = "test_service.test_dag"

            # Call create_or_update_pipeline_entity which creates the pipeline request
            # This will create the CreatePipelineRequest with startDate
            with patch.object(mock_metadata, "create_or_update") as mock_create:
                runner.create_or_update_pipeline_entity(mock_service)

                # Verify that create_or_update was called
                assert mock_create.called

                # Get the CreatePipelineRequest that was passed
                pipeline_request = mock_create.call_args[0][0]
                assert isinstance(pipeline_request, CreatePipelineRequest)

                # Verify that startDate is a timestamp (integer), not an ISO string
                assert pipeline_request.startDate is not None
                assert isinstance(
                    pipeline_request.startDate, int
                ), f"startDate should be an integer timestamp, not {type(pipeline_request.startDate)}"
                assert (
                    pipeline_request.startDate == expected_timestamp
                ), f"startDate should be {expected_timestamp}, got {pipeline_request.startDate}"


def test_pipeline_without_startdate():
    """
    Test that pipeline creation works when DAG has no start date
    """
    # Create a DAG without start date
    dag = DAG(
        dag_id="test_dag_no_date",
        description="Test DAG without start date",
        max_active_tasks=1,
        fileloc="/path/to/dag.py",
    )

    # Create mock metadata client and service
    mock_metadata = Mock()
    mock_metadata.get_by_name.return_value = None
    mock_service = Mock(spec=PipelineService)
    mock_service.fullyQualifiedName = "test_service"

    with patch("airflow_provider_openmetadata.lineage.runner.conf") as mock_conf:
        mock_conf.get.return_value = "http://localhost:8080"
        runner = AirflowLineageRunner(
            metadata=mock_metadata,
            service_name="test_service",
            dag=dag,
        )

        with patch("airflow_provider_openmetadata.lineage.runner.fqn") as mock_fqn:
            mock_fqn.build.return_value = "test_service.test_dag_no_date"

            with patch.object(mock_metadata, "create_or_update") as mock_create:
                runner.create_or_update_pipeline_entity(mock_service)

                pipeline_request = mock_create.call_args[0][0]
                assert isinstance(pipeline_request, CreatePipelineRequest)

                # Verify that startDate is None when DAG has no start date
                assert pipeline_request.startDate is None


def test_task_startdate_format():
    """
    Test that task startDate and endDate remain as ISO format strings
    (tasks use plain string type, not dateTime)
    """
    test_start_date = datetime(2023, 5, 9, 0, 0, 0, tzinfo=timezone.utc)
    expected_iso_string = test_start_date.isoformat()

    dag = DAG(
        dag_id="test_dag",
        start_date=test_start_date,
        max_active_tasks=1,
        fileloc="/path/to/dag.py",
    )

    task = BashOperator(
        task_id="test_task",
        bash_command="echo 'test'",
        dag=dag,
        start_date=test_start_date,
    )

    mock_metadata = Mock()
    mock_service = Mock(spec=PipelineService)
    mock_service.fullyQualifiedName = "test_service"

    with patch("airflow_provider_openmetadata.lineage.runner.conf") as mock_conf:
        mock_conf.get.return_value = "http://localhost:8080"
        runner = AirflowLineageRunner(
            metadata=mock_metadata,
            service_name="test_service",
            dag=dag,
        )

        # Get tasks from the runner
        tasks = runner.get_om_tasks()

        # Verify that task startDate is still an ISO string
        assert len(tasks) == 1
        assert tasks[0].startDate is not None
        assert isinstance(
            tasks[0].startDate, str
        ), f"Task startDate should be a string, not {type(tasks[0].startDate)}"
        assert (
            tasks[0].startDate == expected_iso_string
        ), f"Task startDate should be '{expected_iso_string}', got '{tasks[0].startDate}'"
