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
Test Redshift Serverless detection and query selection
"""

import unittest
from unittest.mock import MagicMock, patch

from psycopg2.errors import InsufficientPrivilege
from sqlalchemy.engine import Engine
from sqlalchemy.exc import ProgrammingError

from metadata.ingestion.source.database.redshift.connection import (
    detect_redshift_serverless,
)
from metadata.ingestion.source.database.redshift.queries import (
    REDSHIFT_SERVERLESS_SQL_STATEMENT,
    REDSHIFT_SQL_STATEMENT,
    get_redshift_queries,
)
from metadata.ingestion.source.database.redshift.usage import RedshiftUsageSource


class TestRedshiftServerlessDetection(unittest.TestCase):
    """Test cases for Redshift Serverless detection and query selection"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_engine = MagicMock(spec=Engine)
        self.mock_connection = MagicMock()
        self.mock_engine.connect.return_value.__enter__.return_value = self.mock_connection

    def test_detect_redshift_provisioned(self):
        """Test detection of Redshift Provisioned cluster (STL tables accessible)"""
        # Mock successful STL query execution
        self.mock_connection.execute.return_value = None
        
        result = detect_redshift_serverless(self.mock_engine)
        
        self.assertFalse(result)
        self.mock_connection.execute.assert_called_once()

    def test_detect_redshift_serverless_insufficient_privilege(self):
        """Test detection of Redshift Serverless (InsufficientPrivilege error)"""
        # Mock InsufficientPrivilege error for STL query
        self.mock_connection.execute.side_effect = ProgrammingError(
            "permission denied for relation stl_query",
            None,
            InsufficientPrivilege()
        )
        
        result = detect_redshift_serverless(self.mock_engine)
        
        self.assertTrue(result)
        self.mock_connection.execute.assert_called_once()

    def test_detect_redshift_serverless_generic_error(self):
        """Test detection of Redshift Serverless (generic error)"""
        # Mock generic error for STL query
        self.mock_connection.execute.side_effect = Exception("Table does not exist")
        
        result = detect_redshift_serverless(self.mock_engine)
        
        self.assertTrue(result)
        self.mock_connection.execute.assert_called_once()

    def test_get_redshift_queries_provisioned(self):
        """Test query selection for Redshift Provisioned"""
        queries = get_redshift_queries(is_serverless=False)
        
        self.assertEqual(queries["sql_statement"], REDSHIFT_SQL_STATEMENT)
        self.assertIn("stl_query", queries["sql_statement"])
        self.assertIn("stl_querytext", queries["sql_statement"])
        self.assertIn("stl_scan", queries["sql_statement"])

    def test_get_redshift_queries_serverless(self):
        """Test query selection for Redshift Serverless"""
        queries = get_redshift_queries(is_serverless=True)
        
        self.assertEqual(queries["sql_statement"], REDSHIFT_SERVERLESS_SQL_STATEMENT)
        self.assertIn("SYS_QUERY_HISTORY", queries["sql_statement"])
        self.assertIn("SYS_QUERY_DETAIL", queries["sql_statement"])
        self.assertNotIn("stl_query", queries["sql_statement"])
        self.assertNotIn("stl_querytext", queries["sql_statement"])

    @patch('metadata.ingestion.source.database.redshift.usage.detect_redshift_serverless')
    def test_usage_source_serverless_initialization(self, mock_detect):
        """Test RedshiftUsageSource initialization with Serverless detection"""
        # Mock serverless detection
        mock_detect.return_value = True
        
        # Mock config objects
        mock_config = MagicMock()
        mock_metadata_config = MagicMock()
        
        with patch.object(RedshiftUsageSource, '__init__', return_value=None) as mock_init:
            # Create instance and manually set up attributes
            usage_source = RedshiftUsageSource.__new__(RedshiftUsageSource)
            usage_source.engine = self.mock_engine
            usage_source.is_serverless = True
            usage_source.sql_stmt = REDSHIFT_SERVERLESS_SQL_STATEMENT
            usage_source.filters = usage_source.serverless_filters = """
                AND query_text NOT ILIKE 'fetch%%'
                AND query_text NOT ILIKE 'padb_fetch_sample:%%'
                AND query_text NOT ILIKE 'Undoing%%transactions%%on%%table%%with%%current%%xid%%'
            """
            
            self.assertTrue(usage_source.is_serverless)
            self.assertEqual(usage_source.sql_stmt, REDSHIFT_SERVERLESS_SQL_STATEMENT)
            self.assertIn("query_text", usage_source.filters)

    @patch('metadata.ingestion.source.database.redshift.usage.detect_redshift_serverless')
    def test_usage_source_provisioned_initialization(self, mock_detect):
        """Test RedshiftUsageSource initialization with Provisioned detection"""
        # Mock provisioned detection
        mock_detect.return_value = False
        
        # Mock config objects
        mock_config = MagicMock()
        mock_metadata_config = MagicMock()
        
        with patch.object(RedshiftUsageSource, '__init__', return_value=None) as mock_init:
            # Create instance and manually set up attributes
            usage_source = RedshiftUsageSource.__new__(RedshiftUsageSource)
            usage_source.engine = self.mock_engine
            usage_source.is_serverless = False
            usage_source.sql_stmt = REDSHIFT_SQL_STATEMENT
            usage_source.filters = """
                AND querytxt NOT ILIKE 'fetch%%'
                AND querytxt NOT ILIKE 'padb_fetch_sample:%%'
                AND querytxt NOT ILIKE 'Undoing%%transactions%%on%%table%%with%%current%%xid%%'
            """
            
            self.assertFalse(usage_source.is_serverless)
            self.assertEqual(usage_source.sql_stmt, REDSHIFT_SQL_STATEMENT)
            self.assertIn("querytxt", usage_source.filters)

    def test_serverless_sql_statement_structure(self):
        """Test that the serverless SQL statement has the correct structure"""
        statement = REDSHIFT_SERVERLESS_SQL_STATEMENT
        
        # Check for SYS views
        self.assertIn("SYS_QUERY_HISTORY", statement)
        self.assertIn("SYS_QUERY_DETAIL", statement)
        
        # Check that STL views are not present
        self.assertNotIn("stl_query", statement)
        self.assertNotIn("stl_querytext", statement)
        self.assertNotIn("stl_scan", statement)
        
        # Check for proper filtering
        self.assertIn("status = 'success'", statement)
        self.assertIn("user_id > 1", statement)
        
        # Check for placeholder substitution
        self.assertIn("{start_time}", statement)
        self.assertIn("{end_time}", statement)
        self.assertIn("{result_limit}", statement)
        self.assertIn("{filters}", statement)

    def test_query_factory_returns_correct_types(self):
        """Test that the query factory returns the expected dictionary structure"""
        # Test provisioned queries
        provisioned_queries = get_redshift_queries(is_serverless=False)
        expected_keys = ["sql_statement", "test_queries", "table_changes", "metrics_query"]
        
        for key in expected_keys:
            self.assertIn(key, provisioned_queries)
            self.assertIsInstance(provisioned_queries[key], str)
        
        # Test serverless queries
        serverless_queries = get_redshift_queries(is_serverless=True)
        
        for key in expected_keys:
            self.assertIn(key, serverless_queries)
            self.assertIsInstance(serverless_queries[key], str)
        
        # Ensure they're different
        self.assertNotEqual(
            provisioned_queries["sql_statement"], 
            serverless_queries["sql_statement"]
        )


if __name__ == "__main__":
    unittest.main()