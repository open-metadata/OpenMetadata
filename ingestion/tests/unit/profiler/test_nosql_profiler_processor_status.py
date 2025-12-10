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
Test NoSQL Profiler Processor Status Reporting

Validates that status records are reported correctly at the profiler processor level
for NoSQL databases, with one status entry per metric group.
"""

from unittest import TestCase
from unittest.mock import Mock, patch
from uuid import uuid4

from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import ColumnName, DataType, Table
from metadata.profiler.api.models import ThreadPoolMetrics
from metadata.profiler.interface.nosql.profiler_interface import NoSQLProfilerInterface
from metadata.profiler.metrics.core import MetricTypes
from metadata.profiler.metrics.static.row_count import RowCount
from metadata.utils.sqa_like_column import SQALikeColumn


class TestNoSQLProfilerProcessorStatus(TestCase):
    """Test status reporting at the NoSQL profiler processor level."""

    @classmethod
    @patch(
        "metadata.profiler.interface.profiler_interface.get_ssl_connection",
        return_value=Mock(),
    )
    def setUpClass(cls, _ssl_mock):
        cls.table_entity = Table(
            id=uuid4(),
            name="test_collection",
            columns=[
                EntityColumn(name=ColumnName("id"), dataType=DataType.STRING),
                EntityColumn(name=ColumnName("name"), dataType=DataType.STRING),
            ],
        )

        cls.mock_connection = Mock()
        cls.mock_connection.__class__.__name__ = "DynamoDBConnection"

        cls.mock_sampler = Mock()

        cls.nosql_profiler_interface = NoSQLProfilerInterface(
            cls.mock_connection,
            None,
            cls.table_entity,
            None,
            cls.mock_sampler,
            5,
            43200,
        )

    def setUp(self):
        self.nosql_profiler_interface.status.records = []
        self.nosql_profiler_interface.status.failures = []

    def test_table_metric_success_reports_status(self):
        """Verify successful table metric execution reports one status per metric group."""
        mock_metric = ThreadPoolMetrics(
            metrics=[RowCount],
            metric_type=MetricTypes.Table,
            column=None,
            table=self.table_entity,
        )

        self.nosql_profiler_interface._get_metric_fn = {
            MetricTypes.Table.value: Mock(return_value={"rowCount": 10})
        }

        mock_client = Mock()
        self.nosql_profiler_interface.compute_metrics(mock_client, mock_metric)

        self.assertEqual(len(self.nosql_profiler_interface.status.records), 1)
        self.assertEqual(
            self.nosql_profiler_interface.status.records[0], "test_collection__Table"
        )

    def test_column_metric_success_reports_status_with_column_name(self):
        """Verify successful column metric execution reports status with column name."""
        col = SQALikeColumn(name="name", type=DataType.STRING)
        mock_metric = ThreadPoolMetrics(
            metrics=[RowCount],
            metric_type=MetricTypes.Static,
            column=col,
            table=self.table_entity,
        )

        self.nosql_profiler_interface._get_metric_fn = {
            MetricTypes.Static.value: Mock(return_value={"nullCount": 0})
        }

        mock_client = Mock()
        self.nosql_profiler_interface.compute_metrics(mock_client, mock_metric)

        self.assertEqual(len(self.nosql_profiler_interface.status.records), 1)
        self.assertEqual(
            self.nosql_profiler_interface.status.records[0],
            "test_collection.name__Static",
        )

    def test_multiple_metric_groups_report_separate_statuses(self):
        """Verify each metric group reports a separate status entry."""
        col_id = SQALikeColumn(name="id", type=DataType.STRING)
        col_name = SQALikeColumn(name="name", type=DataType.STRING)

        table_metric = ThreadPoolMetrics(
            metrics=[RowCount],
            metric_type=MetricTypes.Table,
            column=None,
            table=self.table_entity,
        )
        static_metric_id = ThreadPoolMetrics(
            metrics=[RowCount],
            metric_type=MetricTypes.Static,
            column=col_id,
            table=self.table_entity,
        )
        static_metric_name = ThreadPoolMetrics(
            metrics=[RowCount],
            metric_type=MetricTypes.Static,
            column=col_name,
            table=self.table_entity,
        )

        self.nosql_profiler_interface._get_metric_fn = {
            MetricTypes.Table.value: Mock(return_value={"rowCount": 10}),
            MetricTypes.Static.value: Mock(return_value={"nullCount": 0}),
        }

        mock_client = Mock()
        self.nosql_profiler_interface.compute_metrics(mock_client, table_metric)
        self.nosql_profiler_interface.compute_metrics(mock_client, static_metric_id)
        self.nosql_profiler_interface.compute_metrics(mock_client, static_metric_name)

        self.assertEqual(len(self.nosql_profiler_interface.status.records), 3)
        self.assertIn(
            "test_collection__Table", self.nosql_profiler_interface.status.records
        )
        self.assertIn(
            "test_collection.id__Static", self.nosql_profiler_interface.status.records
        )
        self.assertIn(
            "test_collection.name__Static", self.nosql_profiler_interface.status.records
        )

    def test_metric_failure_reports_failure_status(self):
        """Verify failed metric execution reports a failure status."""
        mock_metric = ThreadPoolMetrics(
            metrics=[RowCount],
            metric_type=MetricTypes.Table,
            column=None,
            table=self.table_entity,
        )

        self.nosql_profiler_interface._get_metric_fn = {
            MetricTypes.Table.value: Mock(side_effect=Exception("Database error"))
        }

        mock_client = Mock()
        self.nosql_profiler_interface.compute_metrics(mock_client, mock_metric)

        self.assertEqual(len(self.nosql_profiler_interface.status.failures), 1)

    def test_column_metric_failure_reports_failure_status(self):
        """Verify failed column metric execution reports a failure status."""
        col = SQALikeColumn(name="name", type=DataType.STRING)
        mock_metric = ThreadPoolMetrics(
            metrics=[RowCount],
            metric_type=MetricTypes.Static,
            column=col,
            table=self.table_entity,
        )

        self.nosql_profiler_interface._get_metric_fn = {
            MetricTypes.Static.value: Mock(side_effect=Exception("Column error"))
        }

        mock_client = Mock()
        self.nosql_profiler_interface.compute_metrics(mock_client, mock_metric)

        self.assertEqual(len(self.nosql_profiler_interface.status.failures), 1)

    def test_mixed_success_and_failure_reports_both(self):
        """Verify mixed success and failure metrics report both statuses."""
        col_id = SQALikeColumn(name="id", type=DataType.STRING)
        col_name = SQALikeColumn(name="name", type=DataType.STRING)

        success_metric = ThreadPoolMetrics(
            metrics=[RowCount],
            metric_type=MetricTypes.Static,
            column=col_id,
            table=self.table_entity,
        )
        failure_metric = ThreadPoolMetrics(
            metrics=[RowCount],
            metric_type=MetricTypes.Static,
            column=col_name,
            table=self.table_entity,
        )

        call_count = 0

        def mock_static_metrics(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return {"nullCount": 0}
            raise Exception("Simulated failure")

        self.nosql_profiler_interface._get_metric_fn = {
            MetricTypes.Static.value: mock_static_metrics
        }

        mock_client = Mock()
        self.nosql_profiler_interface.compute_metrics(mock_client, success_metric)
        self.nosql_profiler_interface.compute_metrics(mock_client, failure_metric)

        self.assertEqual(len(self.nosql_profiler_interface.status.records), 2)
        self.assertEqual(len(self.nosql_profiler_interface.status.failures), 1)
        self.assertEqual(
            self.nosql_profiler_interface.status.records[0],
            "test_collection.id__Static",
        )
