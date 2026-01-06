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
Test Hive MySQL Metastore Dialect
"""

from unittest import TestCase
from unittest.mock import Mock, MagicMock

from metadata.ingestion.source.database.hive.metastore_dialects.mysql.dialect import (
    HiveMysqlMetaStoreDialect,
)


class TestHiveMySQLMetastoreDialect(TestCase):
    """
    Test the Hive MySQL Metastore Dialect, specifically for MySQL < 8.0 compatibility
    """

    def setUp(self):
        """Setup test fixtures"""
        self.dialect = HiveMysqlMetaStoreDialect()

    def test_get_table_columns_query_no_cte(self):
        """
        Test that _get_table_columns generates SQL without CTE (WITH clause)
        for MySQL < 8.0 compatibility
        """
        # Mock connection
        mock_connection = Mock()
        mock_result = MagicMock()
        
        # Mock result data: regular columns and partition columns
        mock_result.fetchall.return_value = [
            ("col1", "string", "First column"),
            ("col2", "int", "Second column"),
            ("partition_col", "string", "Partition column"),
        ]
        mock_connection.execute.return_value = mock_result

        # Call the method
        result = self.dialect._get_table_columns(
            mock_connection, "test_table", "test_schema"
        )

        # Verify connection.execute was called
        self.assertTrue(mock_connection.execute.called)
        
        # Get the query that was executed
        executed_query = mock_connection.execute.call_args[0][0]
        
        # Verify the query does NOT contain WITH clause (CTE)
        self.assertNotIn("WITH", executed_query.upper())
        self.assertNotIn("WITH regular_columns AS", executed_query)
        self.assertNotIn("WITH partition_columns AS", executed_query)
        
        # Verify the query contains UNION ALL (the alternative approach)
        self.assertIn("UNION ALL", executed_query.upper())
        
        # Verify the query contains required table names
        self.assertIn("COLUMNS_V2", executed_query)
        self.assertIn("PARTITION_KEYS", executed_query)
        self.assertIn("TBLS", executed_query)
        
        # Verify the query includes the table name
        self.assertIn("test_table", executed_query)
        
        # Verify the query includes the schema join
        self.assertIn("test_schema", executed_query)
        self.assertIn("DBS", executed_query)
        
        # Verify the result
        self.assertEqual(len(result), 3)
        self.assertEqual(result[0], ("col1", "string", "First column"))
        self.assertEqual(result[1], ("col2", "int", "Second column"))
        self.assertEqual(result[2], ("partition_col", "string", "Partition column"))

    def test_get_table_columns_without_schema(self):
        """
        Test that _get_table_columns works correctly without schema parameter
        """
        # Mock connection
        mock_connection = Mock()
        mock_result = MagicMock()
        
        # Mock result data
        mock_result.fetchall.return_value = [
            ("col1", "string", None),
        ]
        mock_connection.execute.return_value = mock_result

        # Call the method without schema
        result = self.dialect._get_table_columns(
            mock_connection, "test_table", None
        )

        # Verify connection.execute was called
        self.assertTrue(mock_connection.execute.called)
        
        # Get the query that was executed
        executed_query = mock_connection.execute.call_args[0][0]
        
        # Verify no CTE syntax
        self.assertNotIn("WITH", executed_query.upper())
        
        # Verify UNION ALL is present
        self.assertIn("UNION ALL", executed_query.upper())
        
        # Verify the result
        self.assertEqual(len(result), 1)

    def test_get_table_columns_query_structure(self):
        """
        Test that the query structure is correct and compatible with MySQL 5.7
        """
        # Mock connection
        mock_connection = Mock()
        mock_result = MagicMock()
        mock_result.fetchall.return_value = []
        mock_connection.execute.return_value = mock_result

        # Call the method
        self.dialect._get_table_columns(
            mock_connection, "test_table", "test_schema"
        )

        # Get the executed query
        executed_query = mock_connection.execute.call_args[0][0]
        
        # Verify SELECT statements are present
        select_count = executed_query.upper().count("SELECT")
        self.assertEqual(select_count, 2)  # Two SELECT statements joined by UNION ALL
        
        # Verify the first SELECT (regular columns)
        self.assertIn("COLUMN_NAME", executed_query)
        self.assertIn("TYPE_NAME", executed_query)
        self.assertIn("COMMENT", executed_query)
        
        # Verify the second SELECT (partition columns)
        self.assertIn("PKEY_NAME", executed_query)
        self.assertIn("PKEY_TYPE", executed_query)
        self.assertIn("PKEY_COMMENT", executed_query)
        
        # Verify JOINs are present in both parts
        join_count = executed_query.upper().count("JOIN")
        self.assertGreaterEqual(join_count, 6)  # At least 6 JOINs in total

    def test_compatibility_mysql_57_syntax(self):
        """
        Test that the generated SQL is compatible with MySQL 5.7 syntax
        by ensuring it doesn't use MySQL 8.0+ specific features
        """
        # Mock connection
        mock_connection = Mock()
        mock_result = MagicMock()
        mock_result.fetchall.return_value = []
        mock_connection.execute.return_value = mock_result

        # Call the method
        self.dialect._get_table_columns(
            mock_connection, "test_table", "test_schema"
        )

        # Get the executed query
        executed_query = mock_connection.execute.call_args[0][0]
        
        # List of MySQL 8.0+ features that should NOT be present
        mysql_80_features = [
            "WITH",  # Common Table Expressions
            "RECURSIVE",  # Recursive CTEs
            "WINDOW",  # Window functions (though basic ones existed earlier)
            "ROW_NUMBER()",  # Row numbering function
            "RANK()",  # Ranking function
            "DENSE_RANK()",  # Dense ranking function
        ]
        
        for feature in mysql_80_features:
            self.assertNotIn(
                feature,
                executed_query.upper(),
                f"Query should not contain MySQL 8.0+ feature: {feature}"
            )
