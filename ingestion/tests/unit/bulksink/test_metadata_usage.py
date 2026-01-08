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
from unittest import TestCase
from unittest.mock import MagicMock
from uuid import uuid4

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.type.basic import (
    FullyQualifiedEntityName,
    SqlQuery,
    Timestamp,
)
from metadata.generated.schema.type.tableUsageCount import TableUsageCount
from metadata.ingestion.bulksink.metadata_usage import (
    MetadataUsageBulkSink,
    MetadataUsageSinkConfig,
)
from metadata.ingestion.ometa.client import APIError


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
