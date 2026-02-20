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
Unit tests for MetadataUsageBulkSink error handling
"""
import json
import os
import tempfile
from unittest import TestCase
from unittest.mock import MagicMock, patch
from uuid import uuid4

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.type.basic import (
    FullyQualifiedEntityName,
    SqlQuery,
    Timestamp,
)
from metadata.generated.schema.type.tableUsageCount import (
    QueryCostWrapper,
    TableUsageCount,
)
from metadata.ingestion.bulksink.metadata_usage import (
    MetadataUsageBulkSink,
    MetadataUsageSinkConfig,
)
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.mixins.query_mixin import OMetaQueryMixin


def create_api_error(status_code: int, message: str) -> APIError:
    """Helper to create APIError with specific status code"""
    http_error = MagicMock()
    http_error.response.status_code = status_code
    return APIError({"code": status_code, "message": message}, http_error=http_error)


def create_mock_table(name: str = "test_table") -> MagicMock:
    """Create a minimal mock Table entity"""
    table = MagicMock()
    table.id.root = uuid4()
    table.name.root = name
    table.fullyQualifiedName.root = f"service.db.schema.{name}"
    return table


def create_table_usage_with_queries() -> TableUsageCount:
    """Create a TableUsageCount with SQL queries for testing"""
    return TableUsageCount(
        table="test_table",
        date="1702000000000",
        databaseName="test_db",
        databaseSchema="test_schema",
        count=1,
        sqlQueries=[
            CreateQueryRequest(
                query=SqlQuery("SELECT * FROM test_table"),
                queryDate=Timestamp(1702000000000),
                service=FullyQualifiedEntityName("test_service"),
            )
        ],
        joins=[],
        serviceName="test_service",
    )


def create_table_usage() -> TableUsageCount:
    """Create a minimal TableUsageCount for testing (no queries)"""
    return TableUsageCount(
        table="test_table",
        date="1702000000000",
        databaseName="test_db",
        databaseSchema="test_schema",
        count=1,
        sqlQueries=None,
        joins=[],
        serviceName="test_service",
    )


class TestMetadataUsageBulkSinkErrorHandling(TestCase):
    """Test APIError handling in MetadataUsageBulkSink"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_metadata = MagicMock()
        self.config = MetadataUsageSinkConfig(filename="/tmp/test_usage")
        self.sink = MetadataUsageBulkSink(
            config=self.config, metadata=self.mock_metadata
        )
        self.sink.service_name = "test_service"

    def test_api_error_409_logs_warning_and_continues(self):
        """Test that 409 (entity conflict) errors are logged as warnings and don't mark as failed"""
        mock_table = create_mock_table()
        table_usage = create_table_usage_with_queries()

        self.mock_metadata.ingest_entity_queries_data.side_effect = create_api_error(
            409, "Entity already exists"
        )

        initial_failures = len(self.sink.status.failures)
        self.sink.get_table_usage_and_joins([mock_table], table_usage)

        self.assertEqual(
            len(self.sink.status.failures),
            initial_failures,
            "409 error should not add to failures list",
        )

    def test_api_error_400_marks_as_failed(self):
        """Test that 400 (bad request) errors mark the ingestion as failed"""
        mock_table = create_mock_table()
        table_usage = create_table_usage_with_queries()

        self.mock_metadata.ingest_entity_queries_data.side_effect = create_api_error(
            400, "Date range can only include past 30 days starting today"
        )

        initial_failures = len(self.sink.status.failures)
        self.sink.get_table_usage_and_joins([mock_table], table_usage)

        self.assertEqual(
            len(self.sink.status.failures),
            initial_failures + 1,
            "400 error should add to failures list",
        )

    def test_api_error_500_marks_as_failed(self):
        """Test that 500 (server error) errors mark the ingestion as failed"""
        mock_table = create_mock_table()
        table_usage = create_table_usage_with_queries()

        self.mock_metadata.ingest_entity_queries_data.side_effect = create_api_error(
            500, "Internal server error"
        )

        initial_failures = len(self.sink.status.failures)
        self.sink.get_table_usage_and_joins([mock_table], table_usage)

        self.assertEqual(
            len(self.sink.status.failures),
            initial_failures + 1,
            "500 error should add to failures list",
        )

    def test_api_error_409_allows_processing_to_continue(self):
        """Test that after a 409 error, the sink can continue processing other tables"""
        mock_table1 = create_mock_table("table1")
        mock_table2 = create_mock_table("table2")
        table_usage = create_table_usage_with_queries()

        call_count = [0]

        def side_effect_fn(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                raise create_api_error(409, "Entity already exists")
            return None

        self.mock_metadata.ingest_entity_queries_data.side_effect = side_effect_fn

        initial_failures = len(self.sink.status.failures)
        self.sink.get_table_usage_and_joins([mock_table1, mock_table2], table_usage)

        self.assertEqual(
            len(self.sink.status.failures),
            initial_failures,
            "409 errors should not add to failures list",
        )
        self.assertEqual(
            self.mock_metadata.ingest_entity_queries_data.call_count,
            2,
            "Both tables should be processed",
        )


class TestPublishQueryCostNoneHandling(TestCase):
    """
    Test that publish_query_cost handles mask_query returning None
    without crashing (AttributeError: 'NoneType' has no attribute 'encode').

    This was a customer-facing bug where a 13-hour usage workflow would
    complete successfully but crash at the very end during query cost
    publishing when mask_query failed to parse certain SQL queries.
    """

    def _create_mixin_instance(self):
        """Create a minimal OMetaQueryMixin instance with mocked dependencies"""
        obj = OMetaQueryMixin()
        obj.client = MagicMock()
        obj.get_by_name = MagicMock(return_value=None)
        obj.get_suffix = MagicMock(return_value="/api/v1/queries")
        return obj

    def _create_cost_record(self, query="SELECT * FROM t", dialect="trino"):
        """Create a QueryCostWrapper for testing"""
        return QueryCostWrapper(
            cost=1.5,
            count=3.0,
            date="1702000000000",
            query=query,
            dialect=dialect,
            totalDuration=10.0,
        )

    @patch("metadata.ingestion.ometa.mixins.query_mixin.mask_query")
    def test_publish_query_cost_mask_query_returns_none(self, mock_mask_query):
        """
        When mask_query returns None, publish_query_cost should fall back
        to the original query instead of crashing on None.encode().
        """
        mock_mask_query.return_value = None
        obj = self._create_mixin_instance()
        record = self._create_cost_record()

        # Should NOT raise AttributeError: 'NoneType' has no attribute 'encode'
        result = obj.publish_query_cost(record, "test_service")

        # Returns None because get_by_name returns None (query not found)
        self.assertIsNone(result)
        mock_mask_query.assert_called_once_with(record.query, record.dialect)

    @patch("metadata.ingestion.ometa.mixins.query_mixin.mask_query")
    def test_publish_query_cost_mask_query_returns_none_uses_original_query_hash(
        self, mock_mask_query
    ):
        """
        When mask_query returns None, the hash should be computed from the
        original query text, not from None.
        """
        mock_mask_query.return_value = None
        obj = self._create_mixin_instance()
        record = self._create_cost_record(query="SELECT col FROM my_table")

        obj.publish_query_cost(record, "test_service")

        # Verify get_by_name was called with a hash of the original query
        expected_hash = obj._get_query_hash("SELECT col FROM my_table")
        obj.get_by_name.assert_called_once()
        call_kwargs = obj.get_by_name.call_args
        self.assertIn(
            expected_hash,
            str(call_kwargs),
            "Should use hash of original query when mask_query returns None",
        )

    @patch("metadata.ingestion.ometa.mixins.query_mixin.mask_query")
    def test_publish_query_cost_mask_query_returns_valid_string(self, mock_mask_query):
        """
        When mask_query returns a valid masked string, it should be used
        for hashing (normal path).
        """
        mock_mask_query.return_value = "SELECT * FROM t WHERE col = ?"
        obj = self._create_mixin_instance()
        record = self._create_cost_record()

        result = obj.publish_query_cost(record, "test_service")

        self.assertIsNone(result)
        expected_hash = obj._get_query_hash("SELECT * FROM t WHERE col = ?")
        obj.get_by_name.assert_called_once()
        call_kwargs = obj.get_by_name.call_args
        self.assertIn(
            expected_hash,
            str(call_kwargs),
            "Should use hash of masked query",
        )


class TestHandleQueryCostErrorHandling(TestCase):
    """
    Test that handle_query_cost in MetadataUsageBulkSink catches exceptions
    from publish_query_cost so one bad record doesn't crash the entire
    post-workflow query cost processing.
    """

    def setUp(self):
        self.mock_metadata = MagicMock()
        self.config = MetadataUsageSinkConfig(filename=tempfile.mkdtemp())
        self.sink = MetadataUsageBulkSink(
            config=self.config, metadata=self.mock_metadata
        )
        self.sink.service_name = "test_service"

    def tearDown(self):
        import shutil

        if os.path.exists(self.config.filename):
            shutil.rmtree(self.config.filename)

    def _write_cost_file(self, records):
        """Write query cost records to a staging file"""
        filepath = os.path.join(
            self.config.filename, "test_service_1702000000000_query"
        )
        with open(filepath, "w") as f:
            for record in records:
                f.write(json.dumps(record) + "\n")

    def test_handle_query_cost_continues_after_exception(self):
        """
        If publish_query_cost raises an exception for one record,
        handle_query_cost should catch it and continue processing
        remaining records.
        """
        records = [
            {
                "queryHash": "hash1",
                "date": "1702000000000",
                "cost": 1.0,
                "count": 1.0,
                "query": "SELECT bad_query",
                "dialect": "trino",
                "totalDuration": 5.0,
            },
            {
                "queryHash": "hash2",
                "date": "1702000000000",
                "cost": 2.0,
                "count": 1.0,
                "query": "SELECT good_query",
                "dialect": "trino",
                "totalDuration": 3.0,
            },
        ]
        self._write_cost_file(records)

        call_count = [0]

        def side_effect(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                raise AttributeError("'NoneType' object has no attribute 'encode'")
            return None

        self.mock_metadata.publish_query_cost.side_effect = side_effect

        # Should NOT raise - exception is caught internally
        self.sink.handle_query_cost()

        # Both records should have been attempted
        self.assertEqual(
            self.mock_metadata.publish_query_cost.call_count,
            2,
            "Both cost records should be attempted even if first one fails",
        )

    def test_handle_query_cost_no_crash_on_empty_dir(self):
        """handle_query_cost should not crash when there are no cost files"""
        # Directory exists but has no _query files
        self.sink.handle_query_cost()
        self.mock_metadata.publish_query_cost.assert_not_called()

    def test_handle_query_cost_processes_all_records_on_success(self):
        """All records should be published when there are no errors"""
        records = [
            {
                "queryHash": f"hash{i}",
                "date": "1702000000000",
                "cost": float(i),
                "count": 1.0,
                "query": f"SELECT col{i} FROM table{i}",
                "dialect": "trino",
                "totalDuration": float(i),
            }
            for i in range(5)
        ]
        self._write_cost_file(records)

        self.sink.handle_query_cost()

        self.assertEqual(
            self.mock_metadata.publish_query_cost.call_count,
            5,
            "All 5 cost records should be published",
        )
