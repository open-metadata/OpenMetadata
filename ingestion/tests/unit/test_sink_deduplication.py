#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");

"""
Unit test to verify sink-level deduplication of CreateDashboardDataModelRequest
"""

from unittest import TestCase
from unittest.mock import Mock

from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.entity.data.dashboardDataModel import DataModelType
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    SqlQuery,
)
from metadata.ingestion.sink.metadata_rest import (
    MetadataRestSink,
    MetadataRestSinkConfig,
)


class TestSinkDeduplication(TestCase):
    """Test that the sink properly deduplicates duplicate data model requests"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_metadata = Mock()
        self.config = MetadataRestSinkConfig(bulk_sink_batch_size=10)
        self.sink = MetadataRestSink(self.config, self.mock_metadata)

    def test_deduplicate_dashboard_data_models_with_same_name(self):
        """
        Test that multiple CreateDashboardDataModelRequest entities with the same name
        are deduplicated and only the first one is kept in the buffer
        """

        # Create first data model request
        data_model_1 = CreateDashboardDataModelRequest(
            name=EntityName("dfe233d1-903c-46af-922e-e1be9b8dbaab"),
            displayName="Orders Table",
            service=FullyQualifiedEntityName("local_quicksight"),
            dataModelType=DataModelType.QuickSightDataModel,
            columns=[
                Column(
                    name="order_date",
                    dataType=DataType.DATETIME,
                ),
                Column(
                    name="user_id",
                    dataType=DataType.INT,
                ),
            ],
        )

        # Create second data model request with SAME NAME but different columns
        data_model_2 = CreateDashboardDataModelRequest(
            name=EntityName("dfe233d1-903c-46af-922e-e1be9b8dbaab"),  # SAME NAME!
            displayName="Customers Table",
            service=FullyQualifiedEntityName("local_quicksight"),
            dataModelType=DataModelType.QuickSightDataModel,
            columns=[
                Column(
                    name="first_order",
                    dataType=DataType.DATETIME,
                ),
                Column(
                    name="last_name",
                    dataType=DataType.STRING,
                ),
            ],
        )

        # Create third data model request with SAME NAME but different columns
        data_model_3 = CreateDashboardDataModelRequest(
            name=EntityName("dfe233d1-903c-46af-922e-e1be9b8dbaab"),  # SAME NAME!
            displayName="Payments Table",
            service=FullyQualifiedEntityName("local_quicksight"),
            dataModelType=DataModelType.QuickSightDataModel,
            columns=[
                Column(
                    name="payment_date",
                    dataType=DataType.DATETIME,
                ),
            ],
        )

        # Write all three requests
        self.sink.write_create_request(data_model_1)
        self.sink.write_create_request(data_model_2)
        self.sink.write_create_request(data_model_3)

        # Assertions
        # First request should be added to buffer
        self.assertEqual(len(self.sink.buffer), 1)

        # Second and third requests should be deduplicated (not added)
        # Buffer should still only contain 1 item

        # Verify the buffer contains only the first request
        self.assertEqual(self.sink.buffer[0].displayName, "Orders Table")

    def test_different_names_are_not_deduplicated(self):
        """
        Test that CreateDashboardDataModelRequest entities with different names
        are NOT deduplicated
        """

        # Create data models with DIFFERENT names
        data_model_1 = CreateDashboardDataModelRequest(
            name=EntityName("datasource-1"),
            displayName="Data Model 1",
            service=FullyQualifiedEntityName("local_quicksight"),
            dataModelType=DataModelType.QuickSightDataModel,
            columns=[],
        )

        data_model_2 = CreateDashboardDataModelRequest(
            name=EntityName("datasource-2"),  # DIFFERENT NAME
            displayName="Data Model 2",
            service=FullyQualifiedEntityName("local_quicksight"),
            dataModelType=DataModelType.QuickSightDataModel,
            columns=[],
        )

        # Write both requests
        self.sink.write_create_request(data_model_1)
        self.sink.write_create_request(data_model_2)

        # Both should be in the buffer
        self.assertEqual(len(self.sink.buffer), 2)

    def test_deduplicate_queries_with_same_text(self):
        """
        Identical SQL (same checksum) repeated within the dedicated query buffer must be
        deduplicated. Query requests have no name set, so dedup is keyed on the query
        checksum. Stored procedures and scheduled jobs emit the same SQL repeatedly, which
        otherwise produces duplicate-FQN-hash failures in the bulk API.
        """
        query_text = "INSERT INTO members_curated SELECT * FROM members_source WHERE dt = '2026-06-05'"

        queries = [
            CreateQueryRequest(
                query=SqlQuery(query_text),
                service=FullyQualifiedEntityName("Snowflake US"),
            )
            for _ in range(3)
        ]
        for query in queries:
            self.sink.write_query(query)

        self.assertEqual(len(self.sink.query_buffer), 1)
        self.assertEqual(len(self.sink.buffer), 0)

    def test_different_query_text_is_not_deduplicated(self):
        """Queries with different SQL text (different checksum) are NOT deduplicated."""
        query_1 = CreateQueryRequest(
            query=SqlQuery("SELECT 1"),
            service=FullyQualifiedEntityName("Snowflake US"),
        )
        query_2 = CreateQueryRequest(
            query=SqlQuery("SELECT 2"),
            service=FullyQualifiedEntityName("Snowflake US"),
        )

        self.sink.write_query(query_1)
        self.sink.write_query(query_2)

        self.assertEqual(len(self.sink.query_buffer), 2)


if __name__ == "__main__":
    import unittest

    unittest.main()
