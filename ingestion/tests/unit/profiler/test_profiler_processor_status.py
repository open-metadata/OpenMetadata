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
Test Profiler Processor Status Reporting

Validates that status records are reported correctly at the profiler processor level,
with one status entry per metric group.
"""

from unittest import TestCase
from unittest.mock import Mock, patch
from uuid import uuid4

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import declarative_base

from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import ColumnName, DataType, Table
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
    SQLiteScheme,
)
from metadata.profiler.api.models import ThreadPoolMetrics
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.metrics.core import MetricTypes
from metadata.profiler.metrics.static.row_count import RowCount
from metadata.sampler.sqlalchemy.sampler import SQASampler

Base = declarative_base()


class Users(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))


class TestProfilerProcessorStatus(TestCase):
    """Test status reporting at the profiler processor level."""

    @classmethod
    @patch.object(SQASampler, "build_table_orm", return_value=Users)
    def setUpClass(cls, _sampler_mock):
        cls.table_entity = Table(
            id=uuid4(),
            name="users",
            columns=[
                EntityColumn(name=ColumnName("id"), dataType=DataType.INT),
                EntityColumn(name=ColumnName("name"), dataType=DataType.STRING),
            ],
        )

        cls.sqlite_conn = SQLiteConnection(scheme=SQLiteScheme.sqlite_pysqlite)

        sampler = SQASampler(
            service_connection_config=cls.sqlite_conn,
            ometa_client=None,
            entity=None,
        )

        cls.sqa_profiler_interface = SQAProfilerInterface(
            cls.sqlite_conn,
            None,
            cls.table_entity,
            None,
            sampler,
            5,
            43200,
        )

    def setUp(self):
        self.sqa_profiler_interface.status.records = []
        self.sqa_profiler_interface.status.failures = []

    def test_table_metric_success_reports_status(self):
        """Verify successful table metric execution reports one status per metric group."""
        mock_metric = ThreadPoolMetrics(
            metrics=[RowCount],
            metric_type=MetricTypes.Table,
            column=None,
            table=Users,
        )

        self.sqa_profiler_interface._get_metric_fn = {
            MetricTypes.Table.value: Mock(return_value={"rowCount": 10})
        }

        self.sqa_profiler_interface.compute_metrics_in_thread(mock_metric)

        self.assertEqual(len(self.sqa_profiler_interface.status.records), 1)
        self.assertEqual(self.sqa_profiler_interface.status.records[0], "users__Table")

    def test_column_metric_success_reports_status_with_column_name(self):
        """Verify successful column metric execution reports status with column name."""
        col = Column("name", String(256))
        mock_metric = ThreadPoolMetrics(
            metrics=[RowCount],
            metric_type=MetricTypes.Static,
            column=col,
            table=Users,
        )

        self.sqa_profiler_interface._get_metric_fn = {
            MetricTypes.Static.value: Mock(return_value={"nullCount": 0})
        }

        self.sqa_profiler_interface.compute_metrics_in_thread(mock_metric)

        self.assertEqual(len(self.sqa_profiler_interface.status.records), 1)
        self.assertEqual(
            self.sqa_profiler_interface.status.records[0], "users.name__Static"
        )

    def test_multiple_metric_groups_report_separate_statuses(self):
        """Verify each metric group reports a separate status entry."""
        col_id = Column("id", Integer)
        col_name = Column("name", String(256))

        table_metric = ThreadPoolMetrics(
            metrics=[RowCount],
            metric_type=MetricTypes.Table,
            column=None,
            table=Users,
        )
        static_metric_id = ThreadPoolMetrics(
            metrics=[RowCount],
            metric_type=MetricTypes.Static,
            column=col_id,
            table=Users,
        )
        static_metric_name = ThreadPoolMetrics(
            metrics=[RowCount],
            metric_type=MetricTypes.Static,
            column=col_name,
            table=Users,
        )

        self.sqa_profiler_interface._get_metric_fn = {
            MetricTypes.Table.value: Mock(return_value={"rowCount": 10}),
            MetricTypes.Static.value: Mock(return_value={"nullCount": 0}),
        }

        self.sqa_profiler_interface.compute_metrics_in_thread(table_metric)
        self.sqa_profiler_interface.compute_metrics_in_thread(static_metric_id)
        self.sqa_profiler_interface.compute_metrics_in_thread(static_metric_name)

        self.assertEqual(len(self.sqa_profiler_interface.status.records), 3)
        self.assertIn("users__Table", self.sqa_profiler_interface.status.records)
        self.assertIn("users.id__Static", self.sqa_profiler_interface.status.records)
        self.assertIn("users.name__Static", self.sqa_profiler_interface.status.records)

    def test_metric_failure_reports_failure_status(self):
        """Verify failed metric execution reports a failure status."""
        mock_metric = ThreadPoolMetrics(
            metrics=[RowCount],
            metric_type=MetricTypes.Table,
            column=None,
            table=Users,
        )

        self.sqa_profiler_interface._get_metric_fn = {
            MetricTypes.Table.value: Mock(side_effect=Exception("Database error"))
        }

        with patch.object(
            self.sqa_profiler_interface.session.get_bind().dialect,
            "is_disconnect",
            return_value=False,
        ):
            self.sqa_profiler_interface.compute_metrics_in_thread(mock_metric)

        self.assertEqual(len(self.sqa_profiler_interface.status.records), 0)
        self.assertEqual(len(self.sqa_profiler_interface.status.failures), 1)

    def test_column_metric_failure_reports_failure_status(self):
        """Verify failed column metric execution reports a failure status."""
        col = Column("name", String(256))
        mock_metric = ThreadPoolMetrics(
            metrics=[RowCount],
            metric_type=MetricTypes.Static,
            column=col,
            table=Users,
        )

        self.sqa_profiler_interface._get_metric_fn = {
            MetricTypes.Static.value: Mock(side_effect=Exception("Column error"))
        }

        with patch.object(
            self.sqa_profiler_interface.session.get_bind().dialect,
            "is_disconnect",
            return_value=False,
        ):
            self.sqa_profiler_interface.compute_metrics_in_thread(mock_metric)

        self.assertEqual(len(self.sqa_profiler_interface.status.records), 0)
        self.assertEqual(len(self.sqa_profiler_interface.status.failures), 1)

    def test_window_metric_reports_status(self):
        """Verify window metric execution reports status correctly."""
        col = Column("id", Integer)
        mock_metric = ThreadPoolMetrics(
            metrics=[RowCount],
            metric_type=MetricTypes.Window,
            column=col,
            table=Users,
        )

        self.sqa_profiler_interface._get_metric_fn = {
            MetricTypes.Window.value: Mock(return_value={"firstQuartile": 1.0})
        }

        self.sqa_profiler_interface.compute_metrics_in_thread(mock_metric)

        self.assertEqual(len(self.sqa_profiler_interface.status.records), 1)
        self.assertEqual(
            self.sqa_profiler_interface.status.records[0], "users.id__Window"
        )

    def test_query_metric_reports_status(self):
        """Verify query metric execution reports status correctly."""
        col = Column("name", String(256))
        mock_metric = ThreadPoolMetrics(
            metrics=[RowCount],
            metric_type=MetricTypes.Query,
            column=col,
            table=Users,
        )

        self.sqa_profiler_interface._get_metric_fn = {
            MetricTypes.Query.value: Mock(return_value=[{"value": "test", "count": 5}])
        }

        self.sqa_profiler_interface.compute_metrics_in_thread(mock_metric)

        self.assertEqual(len(self.sqa_profiler_interface.status.records), 1)
        self.assertEqual(
            self.sqa_profiler_interface.status.records[0], "users.name__Query"
        )

    def test_mixed_success_and_failure_reports_both(self):
        """Verify mixed success and failure metrics report both statuses."""
        col_id = Column("id", Integer)
        col_name = Column("name", String(256))

        success_metric = ThreadPoolMetrics(
            metrics=[RowCount],
            metric_type=MetricTypes.Static,
            column=col_id,
            table=Users,
        )
        failure_metric = ThreadPoolMetrics(
            metrics=[RowCount],
            metric_type=MetricTypes.Static,
            column=col_name,
            table=Users,
        )

        call_count = 0

        def mock_static_metrics(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return {"nullCount": 0}
            raise Exception("Simulated failure")

        self.sqa_profiler_interface._get_metric_fn = {
            MetricTypes.Static.value: mock_static_metrics
        }

        self.sqa_profiler_interface.compute_metrics_in_thread(success_metric)

        with patch.object(
            self.sqa_profiler_interface.session.get_bind().dialect,
            "is_disconnect",
            return_value=False,
        ):
            self.sqa_profiler_interface.compute_metrics_in_thread(failure_metric)

        self.assertEqual(len(self.sqa_profiler_interface.status.records), 1)
        self.assertEqual(len(self.sqa_profiler_interface.status.failures), 1)
        self.assertEqual(
            self.sqa_profiler_interface.status.records[0], "users.id__Static"
        )
