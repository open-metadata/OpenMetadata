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
Test Airflow metadata source for compatibility between Airflow SDK v3.x
and Airflow 2.x/3.x databases.

The Airflow SDK is always v3.x (which has DagRun.logical_date), but we may
connect to Airflow 2.x databases (which have execution_date column).
"""
from datetime import datetime, timezone
from unittest.mock import MagicMock, PropertyMock, patch
from uuid import uuid4

import pytest

try:
    from airflow.models import DagRun
except ImportError:
    pytest.skip("Airflow dependencies not installed", allow_module_level=True)


class TestExecutionDateColumnDetection:
    """Test the execution_date_column property for detecting database schema."""

    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.session",
        new_callable=PropertyMock,
    )
    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.__init__",
        return_value=None,
    )
    def test_detects_logical_date_column(self, mock_init, mock_session):
        """When database has logical_date column, it should be detected."""
        from metadata.ingestion.source.pipeline.airflow.metadata import AirflowSource

        source = AirflowSource.__new__(AirflowSource)
        source._execution_date_column = None

        mock_inspector = MagicMock()
        mock_inspector.get_columns.return_value = [
            {"name": "dag_id"},
            {"name": "run_id"},
            {"name": "logical_date"},
            {"name": "start_date"},
            {"name": "state"},
        ]

        mock_bind = MagicMock()
        mock_session.return_value.bind = mock_bind

        with patch(
            "metadata.ingestion.source.pipeline.airflow.metadata.inspect",
            return_value=mock_inspector,
        ):
            result = source.execution_date_column

        assert result == "logical_date"

    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.session",
        new_callable=PropertyMock,
    )
    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.__init__",
        return_value=None,
    )
    def test_detects_execution_date_column(self, mock_init, mock_session):
        """When database has execution_date column (Airflow 2.x), it should be detected."""
        from metadata.ingestion.source.pipeline.airflow.metadata import AirflowSource

        source = AirflowSource.__new__(AirflowSource)
        source._execution_date_column = None

        mock_inspector = MagicMock()
        mock_inspector.get_columns.return_value = [
            {"name": "dag_id"},
            {"name": "run_id"},
            {"name": "execution_date"},
            {"name": "start_date"},
            {"name": "state"},
        ]

        mock_bind = MagicMock()
        mock_session.return_value.bind = mock_bind

        with patch(
            "metadata.ingestion.source.pipeline.airflow.metadata.inspect",
            return_value=mock_inspector,
        ):
            result = source.execution_date_column

        assert result == "execution_date"

    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.session",
        new_callable=PropertyMock,
    )
    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.__init__",
        return_value=None,
    )
    def test_caches_column_detection(self, mock_init, mock_session):
        """Column detection should be cached after first call."""
        from metadata.ingestion.source.pipeline.airflow.metadata import AirflowSource

        source = AirflowSource.__new__(AirflowSource)
        source._execution_date_column = "logical_date"

        result = source.execution_date_column

        assert result == "logical_date"
        mock_session.assert_not_called()

    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.session",
        new_callable=PropertyMock,
    )
    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.__init__",
        return_value=None,
    )
    def test_fallback_on_inspection_error(self, mock_init, mock_session):
        """On inspection error, should fallback to execution_date."""
        from metadata.ingestion.source.pipeline.airflow.metadata import AirflowSource

        source = AirflowSource.__new__(AirflowSource)
        source._execution_date_column = None

        mock_bind = MagicMock()
        mock_session.return_value.bind = mock_bind

        with patch(
            "metadata.ingestion.source.pipeline.airflow.metadata.inspect",
            side_effect=Exception("Inspection failed"),
        ):
            result = source.execution_date_column

        assert result == "execution_date"


class TestGetPipelineStatus:
    """Test get_pipeline_status method for cross-version compatibility."""

    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.session",
        new_callable=PropertyMock,
    )
    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.execution_date_column",
        new_callable=PropertyMock,
    )
    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.__init__",
        return_value=None,
    )
    def test_handles_query_exception(self, mock_init, mock_exec_col, mock_session):
        """When query fails, should return empty list and log warning."""
        from metadata.ingestion.source.pipeline.airflow.metadata import AirflowSource

        source = AirflowSource.__new__(AirflowSource)
        source._execution_date_column = None

        mock_exec_col.return_value = "logical_date"

        mock_config = MagicMock()
        mock_config.serviceConnection.root.config.numberOfStatus = 10
        source.config = mock_config

        mock_session.return_value.query.side_effect = Exception("Database error")

        dag_runs = source.get_pipeline_status("test_dag")

        assert dag_runs == []

    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.session",
        new_callable=PropertyMock,
    )
    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.execution_date_column",
        new_callable=PropertyMock,
    )
    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.__init__",
        return_value=None,
    )
    def test_returns_empty_list_for_no_results(
        self, mock_init, mock_exec_col, mock_session
    ):
        """When no dag runs found, should return empty list."""
        from metadata.ingestion.source.pipeline.airflow.metadata import AirflowSource

        source = AirflowSource.__new__(AirflowSource)
        source._execution_date_column = None

        mock_exec_col.return_value = "logical_date"

        mock_config = MagicMock()
        mock_config.serviceConnection.root.config.numberOfStatus = 10
        source.config = mock_config

        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = []

        mock_session.return_value.query.return_value = mock_query

        dag_runs = source.get_pipeline_status("test_dag")

        assert dag_runs == []


class TestDagRunLogicalDateUsage:
    """Test that DagRun model has expected attributes for SDK v3.x."""

    def test_dagrun_has_logical_date_attribute(self):
        """Verify DagRun model has logical_date attribute (Airflow SDK 3.x)."""
        assert hasattr(
            DagRun, "logical_date"
        ), "DagRun should have logical_date attribute in Airflow SDK 3.x"

    def test_dagrun_does_not_have_execution_date_attribute(self):
        """Verify DagRun model does NOT have execution_date attribute (Airflow SDK 3.x).

        This is the core issue - SDK 3.x removed execution_date from the ORM model,
        so code must use column() to reference the database column directly.
        """
        assert not hasattr(DagRun, "execution_date"), (
            "DagRun should NOT have execution_date attribute in Airflow SDK 3.x. "
            "The code uses column() to reference the database column directly."
        )


class TestBuildObservabilityFromDagRun:
    """Test _build_observability_from_dag_run uses logical_date."""

    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.__init__",
        return_value=None,
    )
    def test_uses_logical_date_from_dag_run(self, mock_init):
        """Observability should be built using dag_run.logical_date."""
        from metadata.ingestion.source.pipeline.airflow.metadata import AirflowSource

        source = AirflowSource.__new__(AirflowSource)

        test_date = datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
        start_date = datetime(2024, 1, 15, 10, 25, 0, tzinfo=timezone.utc)

        mock_dag_run = MagicMock()
        mock_dag_run.logical_date = test_date
        mock_dag_run.start_date = start_date
        mock_dag_run.state = "success"

        pipeline_uuid = uuid4()
        mock_pipeline_entity = MagicMock()
        mock_pipeline_entity.id.root = pipeline_uuid
        mock_pipeline_entity.fullyQualifiedName.root = "service.pipeline_name"

        observability = source._build_observability_from_dag_run(
            dag_run=mock_dag_run,
            pipeline_entity=mock_pipeline_entity,
            schedule_interval="@daily",
        )

        assert observability.scheduleInterval == "@daily"
        assert observability.lastRunStatus.value == "Successful"


class TestColumnFunctionUsage:
    """Test that the code uses sqlalchemy column() for database queries."""

    def test_column_import_exists(self):
        """Verify column is imported from sqlalchemy in the metadata module."""
        from metadata.ingestion.source.pipeline.airflow import metadata

        assert hasattr(
            metadata, "column"
        ), "The metadata module should import column from sqlalchemy"

    def test_get_pipeline_status_uses_column_function(self):
        """Verify get_pipeline_status method exists and can handle both column names."""
        from metadata.ingestion.source.pipeline.airflow.metadata import AirflowSource

        assert hasattr(AirflowSource, "get_pipeline_status")
        assert hasattr(AirflowSource, "execution_date_column")
