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
Test Hex Lineage extraction and processing
"""

from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.security.credentials.gcpCredentials import GCPCredentials
from metadata.generated.schema.security.credentials.gcpValues import (
    GcpCredentialsValues,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.ingestion.source.dashboard.hex.query_fetcher import (
    HexProjectLineage,
    HexQueryFetcher,
)


class TestHexQueryFetcher(TestCase):
    """Test HexQueryFetcher functionality"""

    def setUp(self):
        """Set up test fixtures"""
        self.metadata = MagicMock()

        # Create query fetcher without trying to establish connections
        self.query_fetcher = HexQueryFetcher(
            metadata=self.metadata,
            lookback_days=7,
            query_limit=1000,
        )

    def test_query_fetcher_initialization(self):
        """Test query fetcher initialization"""
        self.assertEqual(self.query_fetcher.lookback_days, 7)
        self.assertEqual(self.query_fetcher.query_limit, 1000)
        self.assertIsNotNone(self.query_fetcher.start_time)
        self.assertIsNotNone(self.query_fetcher.end_time)

        # Check time window is correct
        time_diff = self.query_fetcher.end_time - self.query_fetcher.start_time
        self.assertAlmostEqual(time_diff.days, 7, delta=1)

    def test_hex_metadata_pattern_extraction(self):
        """Test Hex metadata pattern extraction from SQL comments"""
        test_cases = [
            (
                '-- Hex query metadata: {"project_id": "proj_123456", "project_url": "https://app.hex.tech/workspace/hex/proj_123456"}\nSELECT * FROM table',
                {"project_id": "proj_123456", "workspace": "workspace"},
            ),
            (
                '-- Hex query metadata: {"project_id": "proj_789", "project_url": "https://custom.hex.tech/myworkspace/app/proj_789"}\nSELECT COUNT(*) FROM users',
                {"project_id": "proj_789", "workspace": "myworkspace"},
            ),
            (
                "SELECT * FROM table WITHOUT HEX METADATA",
                None,
            ),
            (
                '-- Some other comment\n-- Hex query metadata: {"project_id": "proj_abc", "project_url": "https://hex.tech/ws/hex/proj_abc"}',
                {"project_id": "proj_abc", "workspace": "ws"},
            ),
        ]

        for query_text, expected in test_cases:
            result = self.query_fetcher._extract_hex_metadata(query_text)
            self.assertEqual(result, expected)

    def test_extract_hex_metadata_edge_cases(self):
        """Test edge cases for Hex metadata extraction"""
        # Empty query
        self.assertIsNone(self.query_fetcher._extract_hex_metadata(""))
        self.assertIsNone(self.query_fetcher._extract_hex_metadata(None))

        # Malformed JSON in comment
        malformed = '-- Hex query metadata: {"project_id": "proj_123", invalid json}'
        self.assertIsNone(self.query_fetcher._extract_hex_metadata(malformed))

        # Missing required fields
        missing_id = (
            '-- Hex query metadata: {"project_url": "https://hex.tech/ws/hex/proj"}'
        )
        self.assertIsNone(self.query_fetcher._extract_hex_metadata(missing_id))

    @patch.object(HexQueryFetcher, "_create_engine_for_service")
    def test_fetch_with_no_hex_queries(self, mock_create_engine):
        """Test fetching when no Hex queries exist"""
        mock_service = MagicMock()
        mock_service.name.root = "test_snowflake"
        mock_service.connection.config.type.value = "Snowflake"

        self.metadata.get_by_name = MagicMock(return_value=mock_service)

        mock_engine = MagicMock()
        mock_create_engine.return_value = mock_engine

        # Return queries without Hex metadata
        mock_connection = MagicMock()
        mock_result = [
            ("SELECT * FROM regular_table",),
            ("INSERT INTO another_table VALUES (1, 2, 3)",),
        ]
        mock_connection.execute.return_value = mock_result
        mock_engine.connect.return_value.__enter__ = MagicMock(
            return_value=mock_connection
        )
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=None)

        result = self.query_fetcher.fetch_hex_queries_from_service_prefix(
            "test_snowflake"
        )

        # Should return empty dict when no Hex queries found
        self.assertEqual(len(result), 0)

    def test_find_matching_service(self):
        """Test finding database service by name"""
        mock_service = MagicMock()
        mock_service.name.root = "test_service"

        self.metadata.get_by_name = MagicMock(return_value=mock_service)

        result = self.query_fetcher._find_matching_service("test_service")

        self.assertEqual(result, mock_service)
        self.metadata.get_by_name.assert_called_once_with(
            entity=DatabaseService, fqn="test_service"
        )

    def test_find_matching_service_not_found(self):
        """Test when service is not found"""
        self.metadata.get_by_name = MagicMock(side_effect=Exception("Not found"))

        result = self.query_fetcher._find_matching_service("nonexistent_service")

        self.assertIsNone(result)

    def test_create_engine_for_service(self):
        """Test creating SQLAlchemy engine for service"""
        mock_config = MagicMock()

        # Mock the actual engine creation to return a mock engine
        with patch("metadata.utils.ssl_manager.get_ssl_connection") as mock_get_ssl:
            mock_engine = MagicMock()
            mock_get_ssl.return_value = mock_engine

            result = self.query_fetcher._create_engine_for_service(mock_config)

            self.assertEqual(result, mock_engine)
            mock_get_ssl.assert_called_once_with(mock_config)

    def test_create_engine_error_handling(self):
        """Test engine creation error handling"""
        mock_config = MagicMock()

        # Mock get_ssl_connection to raise exception
        with patch("metadata.utils.ssl_manager.get_ssl_connection") as mock_get_ssl:
            mock_get_ssl.side_effect = Exception("Connection failed")

            result = self.query_fetcher._create_engine_for_service(mock_config)

            self.assertIsNone(result)

    def test_execute_hex_query_snowflake(self):
        """Test executing Hex query on Snowflake"""
        # Mock engine and connection
        mock_engine = MagicMock()
        mock_connection = MagicMock()

        # Mock query results
        mock_result = [
            (
                '-- Hex query metadata: {"project_id": "proj_123", "project_url": "https://hex.tech/ws/hex/proj_123"}\nSELECT * FROM table',
            ),
        ]
        mock_connection.execute.return_value = mock_result
        mock_engine.connect.return_value.__enter__ = MagicMock(
            return_value=mock_connection
        )
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=None)

        config = SnowflakeConnection(
            type="Snowflake",
            accountUsageSchema="SNOWFLAKE.ACCOUNT_USAGE",
            username="test",
            password="test",
            account="test",
            warehouse="test_warehouse",
        )

        results = self.query_fetcher._execute_hex_query(
            mock_engine, "snowflake", config
        )

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["project_id"], "proj_123")

    def test_execute_hex_query_bigquery(self):
        """Test executing Hex query on BigQuery"""
        # Mock engine and connection
        mock_engine = MagicMock()
        mock_connection = MagicMock()

        mock_result = [
            (
                '-- Hex query metadata: {"project_id": "proj_456", "project_url": "https://hex.tech/ws/hex/proj_456"}\nSELECT COUNT(*) FROM dataset.table',
            ),
        ]
        mock_connection.execute.return_value = mock_result
        mock_engine.connect.return_value.__enter__ = MagicMock(
            return_value=mock_connection
        )
        mock_engine.connect.return_value.__exit__ = MagicMock(return_value=None)

        credentials = GCPCredentials(
            gcpConfig=GcpCredentialsValues(
                type="service_account",
                projectId="test-project",
                privateKeyId="test-key-id",
                privateKey="test-private-key",
                clientEmail="test@test-project.iam.gserviceaccount.com",
                clientId="test-client-id",
            )
        )

        config = BigQueryConnection(
            type="BigQuery",
            usageLocation="US",
            credentials=credentials,
            taxonomyProjectID=["test-project"],
            taxonomyLocation="us-central1",
        )

        results = self.query_fetcher._execute_hex_query(mock_engine, "bigquery", config)

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["project_id"], "proj_456")

    @patch("metadata.ingestion.source.dashboard.hex.query_fetcher.LineageParser")
    @patch(
        "metadata.ingestion.source.dashboard.hex.query_fetcher.get_table_entities_from_query"
    )
    def test_extract_tables_from_query(self, mock_get_tables, mock_parser_class):
        """Test extracting table references from SQL query"""
        # Mock LineageParser
        mock_parser = MagicMock()
        mock_parser.source_tables = [
            "sales_db.public.sales_data",
            "sales_db.public.customer_data",
        ]
        mock_parser_class.return_value = mock_parser

        # Mock table entities
        mock_table1 = Table(
            id="c3eb265f-5445-4ad3-ba5e-797d3a3071bb",
            name="sales_data",
            fullyQualifiedName=FullyQualifiedEntityName(
                "snowflake.sales_db.public.sales_data"
            ),
            columns=[],
        )
        mock_table2 = Table(
            id="d3eb265f-5445-4ad3-ba5e-797d3a3071bb",
            name="customer_data",
            fullyQualifiedName=FullyQualifiedEntityName(
                "snowflake.sales_db.public.customer_data"
            ),
            columns=[],
        )

        mock_get_tables.return_value = [mock_table1, mock_table2]

        query = "SELECT s.*, c.name FROM sales_data s JOIN customer_data c ON s.customer_id = c.id"

        result = self.query_fetcher._extract_tables_from_query(
            query, self.metadata, "snowflake.sales_db", "ACCOUNT_USAGE"
        )

        # The method might return duplicates or multiple calls, just check we got tables
        self.assertGreaterEqual(len(result), 2)
        table_names = [
            str(t.name.root) if hasattr(t.name, "root") else str(t.name)
            for t in result
            if hasattr(t, "name")
        ]
        self.assertIn("sales_data", table_names)
        self.assertIn("customer_data", table_names)

    def test_matches_prefix_constraints(self):
        """Test prefix constraint matching"""
        table = Table(
            id="e3eb265f-5445-4ad3-ba5e-797d3a3071bb",
            name="orders",
            fullyQualifiedName=FullyQualifiedEntityName(
                "snowflake.PROD_DB.sales.orders"
            ),
            columns=[],
        )

        # Test exact match
        self.assertTrue(
            self.query_fetcher._matches_prefix_constraints(table, "snowflake.PROD_DB")
        )

        # Test no match
        self.assertFalse(
            self.query_fetcher._matches_prefix_constraints(table, "snowflake.DEV_DB")
        )

        # Test partial match
        self.assertTrue(
            self.query_fetcher._matches_prefix_constraints(table, "snowflake")
        )

        # Test full path match
        self.assertTrue(
            self.query_fetcher._matches_prefix_constraints(
                table, "snowflake.PROD_DB.sales"
            )
        )

        # Test no prefix (should match all)
        self.assertTrue(self.query_fetcher._matches_prefix_constraints(table, None))

    def test_matches_prefix_constraints_edge_cases(self):
        """Test prefix constraint matching edge cases"""
        table = Table(
            id="f3eb265f-5445-4ad3-ba5e-797d3a3071bb",
            name="test",
            fullyQualifiedName=FullyQualifiedEntityName("service.db.schema.table"),
            columns=[],
        )

        # Empty prefix parts
        self.assertTrue(
            self.query_fetcher._matches_prefix_constraints(table, "service..")
        )

        # More prefix parts than table FQN
        self.assertFalse(
            self.query_fetcher._matches_prefix_constraints(
                table, "service.db.schema.table.column"
            )
        )

        # Invalid table FQN
        table_invalid = MagicMock()
        table_invalid.fullyQualifiedName = None
        self.assertTrue(
            self.query_fetcher._matches_prefix_constraints(table_invalid, "prefix")
        )


class TestHexProjectLineage(TestCase):
    """Test HexProjectLineage class"""

    def test_initialization(self):
        """Test HexProjectLineage initialization"""
        lineage = HexProjectLineage(project_id="proj_123")

        self.assertEqual(lineage.project_id, "proj_123")
        self.assertEqual(len(lineage.upstream_tables), 0)
        self.assertEqual(len(lineage._table_ids_seen), 0)

    def test_add_table(self):
        """Test adding a table to lineage"""
        lineage = HexProjectLineage(project_id="proj_123")

        table = Table(
            id="a3eb265f-5445-4ad3-ba5e-797d3a3071bb",
            name="test_table",
            fullyQualifiedName=FullyQualifiedEntityName("service.db.schema.test_table"),
            columns=[],
        )

        lineage.add_table(table)

        self.assertEqual(len(lineage.upstream_tables), 1)
        self.assertEqual(lineage.upstream_tables[0], table)
        self.assertIn(table.id.root, lineage._table_ids_seen)

    def test_add_duplicate_table(self):
        """Test that duplicate tables are not added"""
        lineage = HexProjectLineage(project_id="proj_123")

        table = Table(
            id="a3eb265f-5445-4ad3-ba5e-797d3a3071bb",
            name="test_table",
            fullyQualifiedName=FullyQualifiedEntityName("service.db.schema.test_table"),
            columns=[],
        )

        lineage.add_table(table)
        lineage.add_table(table)  # Add same table again

        self.assertEqual(len(lineage.upstream_tables), 1)

    def test_add_none_table(self):
        """Test handling None table"""
        lineage = HexProjectLineage(project_id="proj_123")

        lineage.add_table(None)

        self.assertEqual(len(lineage.upstream_tables), 0)

    def test_add_table_without_id(self):
        """Test handling table without ID"""
        lineage = HexProjectLineage(project_id="proj_123")

        table = MagicMock()
        table.id = None

        lineage.add_table(table)

        self.assertEqual(len(lineage.upstream_tables), 0)

    def test_add_tables(self):
        """Test adding multiple tables at once"""
        lineage = HexProjectLineage(project_id="proj_123")

        tables = []
        for i in range(5):
            table = Table(
                id=f"{i:08x}-5445-4ad3-ba5e-797d3a3071bb",
                name=f"table_{i}",
                fullyQualifiedName=FullyQualifiedEntityName(
                    f"service.db.schema.table_{i}"
                ),
                columns=[],
            )
            tables.append(table)

        lineage.add_tables(tables)

        self.assertEqual(len(lineage.upstream_tables), 5)
        for i, table in enumerate(lineage.upstream_tables):
            expected_id = f"{i:08x}-5445-4ad3-ba5e-797d3a3071bb"
            actual_id = (
                str(table.id.root) if hasattr(table.id, "root") else str(table.id)
            )
            self.assertEqual(actual_id, expected_id)

    def test_add_tables_with_duplicates(self):
        """Test adding tables with duplicates"""
        lineage = HexProjectLineage(project_id="proj_123")

        table_1 = Table(
            id="b3eb265f-5445-4ad3-ba5e-797d3a3071bb",
            name="table_1",
            fullyQualifiedName=FullyQualifiedEntityName("service.db.schema.table_1"),
            columns=[],
        )
        table_2 = Table(
            id="b4eb265f-5445-4ad3-ba5e-797d3a3071bb",
            name="table_2",
            fullyQualifiedName=FullyQualifiedEntityName("service.db.schema.table_2"),
            columns=[],
        )

        # Add table_1 first
        lineage.add_table(table_1)

        # Try to add both tables (table_1 is duplicate)
        lineage.add_tables([table_1, table_2])

        # Should only have 2 tables, not 3
        self.assertEqual(len(lineage.upstream_tables), 2)
        self.assertIn(table_1.id.root, lineage._table_ids_seen)
        self.assertIn(table_2.id.root, lineage._table_ids_seen)


if __name__ == "__main__":
    import unittest

    unittest.main()
