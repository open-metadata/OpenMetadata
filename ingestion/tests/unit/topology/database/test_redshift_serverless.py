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
    get_redshift_instance_type,
)
from metadata.ingestion.source.database.redshift.models import RedshiftInstanceType
from metadata.ingestion.source.database.redshift.queries import (
    REDSHIFT_SQL_STATEMENT_MAP,
)

# Mock Redshift configuration for testing
mock_redshift_config = {
    "source": {
        "type": "redshift",
        "serviceName": "local_redshift_serverless",
        "serviceConnection": {
            "config": {
                "type": "Redshift",
                "username": "username",
                "password": "password",
                "database": "database",
                "hostPort": "workgroup.account.region.redshift-serverless.amazonaws.com:5439",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "redshift"},
        }
    },
}


class TestRedshiftServerlessDetection(unittest.TestCase):
    """Test cases for Redshift Serverless detection and query selection"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_engine = MagicMock(spec=Engine)
        self.mock_connection = MagicMock()
        self.mock_engine.connect.return_value.__enter__.return_value = (
            self.mock_connection
        )

    def test_detect_serverless_when_stl_not_accessible(self):
        """Test detection of Redshift Serverless when STL tables are not accessible (InsufficientPrivilege error)"""
        # Mock InsufficientPrivilege error for STL query
        self.mock_connection.execute.side_effect = ProgrammingError(
            "permission denied for relation stl_query", None, InsufficientPrivilege()
        )

        result = get_redshift_instance_type(self.mock_engine)

        self.assertEqual(result, RedshiftInstanceType.SERVERLESS)
        self.mock_connection.execute.assert_called_once()

    def test_detect_serverless_generic_error(self):
        """Test detection of Redshift Serverless on generic STL access error"""
        # Mock generic error for STL query
        self.mock_connection.execute.side_effect = ProgrammingError(
            'relation "stl_query" does not exist', {}, None
        )

        result = get_redshift_instance_type(self.mock_engine)

        self.assertEqual(result, RedshiftInstanceType.SERVERLESS)
        self.mock_connection.execute.assert_called_once()

    def test_detect_provisioned_when_stl_accessible(self):
        """Test detection of Redshift Provisioned cluster when STL tables are accessible"""
        # Mock successful STL query execution
        self.mock_connection.execute.return_value = None

        result = get_redshift_instance_type(self.mock_engine)

        self.assertEqual(result, RedshiftInstanceType.PROVISIONED)
        self.mock_connection.execute.assert_called_once()

    def test_serverless_uses_sys_queries(self):
        """Test that Serverless uses SYS-based queries"""
        sql = REDSHIFT_SQL_STATEMENT_MAP[RedshiftInstanceType.SERVERLESS]

        # Must use SYS views
        self.assertIn("SYS_QUERY_HISTORY", sql)
        self.assertIn("SYS_QUERY_TEXT", sql)
        self.assertIn("SYS_QUERY_DETAIL", sql)

        # Should NOT use STL tables
        self.assertNotIn("stl_query", sql.lower())
        self.assertNotIn("stl_querytext", sql.lower())
        self.assertNotIn("stl_scan", sql.lower())

        # Check for proper filtering
        self.assertIn("LOWER(status) = 'success'", sql)
        self.assertIn("user_id > 1", sql)

        # Check for placeholder substitution
        self.assertIn("{start_time}", sql)
        self.assertIn("{end_time}", sql)
        self.assertIn("{result_limit}", sql)
        self.assertIn("{filters}", sql)

    def test_provisioned_uses_stl_queries(self):
        """Test that Provisioned uses STL-based queries"""
        sql = REDSHIFT_SQL_STATEMENT_MAP[RedshiftInstanceType.PROVISIONED]

        # Must use STL tables
        self.assertIn("stl_query", sql.lower())
        self.assertIn("stl_querytext", sql.lower())

        # Should NOT use SYS views
        self.assertNotIn("SYS_QUERY_HISTORY", sql)
        self.assertNotIn("SYS_QUERY_TEXT", sql)
        self.assertNotIn("SYS_QUERY_DETAIL", sql)

    def test_serverless_sql_statement_structure(self):
        """Test that the serverless SQL statement has the correct structure"""
        statement = REDSHIFT_SQL_STATEMENT_MAP[RedshiftInstanceType.SERVERLESS]

        # Check for SYS views
        self.assertIn("SYS_QUERY_HISTORY", statement)
        self.assertIn("SYS_QUERY_DETAIL", statement)

        # Check that STL views are not present
        self.assertNotIn("stl_query", statement.lower())
        self.assertNotIn("stl_querytext", statement.lower())
        self.assertNotIn("stl_scan", statement.lower())

        # Check for proper filtering
        self.assertIn("LOWER(status) = 'success'", statement)
        self.assertIn("user_id > 1", statement)

        # Check for placeholder substitution
        self.assertIn("{start_time}", statement)
        self.assertIn("{end_time}", statement)
        self.assertIn("{result_limit}", statement)
        self.assertIn("{filters}", statement)

    @patch(
        "metadata.ingestion.source.database.redshift.usage.get_redshift_instance_type"
    )
    def test_usage_source_serverless_filter_validation(self, mock_get_instance_type):
        """Test that Serverless usage source uses correct filters with 'query_text' column"""
        from metadata.ingestion.source.database.redshift.usage import (
            RedshiftUsageSource,
        )

        mock_get_instance_type.return_value = RedshiftInstanceType.SERVERLESS

        # Create instance without full initialization
        usage_source = RedshiftUsageSource.__new__(RedshiftUsageSource)
        usage_source.engine = self.mock_engine
        usage_source.redshift_instance_type = mock_get_instance_type.return_value

        # Simulate __init__ logic for filter and statement selection
        if usage_source.redshift_instance_type == RedshiftInstanceType.SERVERLESS:
            usage_source.sql_stmt = REDSHIFT_SQL_STATEMENT_MAP[
                RedshiftInstanceType.SERVERLESS
            ]
            usage_source.filters = RedshiftUsageSource.serverless_filters

        # Verify instance type
        self.assertEqual(
            usage_source.redshift_instance_type, RedshiftInstanceType.SERVERLESS
        )

        # Verify SQL statement
        self.assertEqual(
            usage_source.sql_stmt,
            REDSHIFT_SQL_STATEMENT_MAP[RedshiftInstanceType.SERVERLESS],
        )

        # CRITICAL: Verify filters use 'query_text' (not 'querytxt')
        self.assertIn("query_text", usage_source.filters)
        self.assertNotIn("querytxt", usage_source.filters)

        # Verify specific filter patterns
        self.assertIn("NOT ILIKE 'fetch%%'", usage_source.filters)
        self.assertIn("NOT ILIKE 'padb_fetch_sample:%%'", usage_source.filters)
        self.assertIn(
            "NOT ILIKE 'Undoing%%transactions%%on%%table%%with%%current%%xid%%'",
            usage_source.filters,
        )

    @patch(
        "metadata.ingestion.source.database.redshift.lineage.get_redshift_instance_type"
    )
    def test_lineage_source_serverless_filter_validation(self, mock_get_instance_type):
        """Test that Serverless lineage source uses correct filters with 'query_text' column"""
        from metadata.ingestion.source.database.redshift.lineage import (
            RedshiftLineageSource,
        )

        mock_get_instance_type.return_value = RedshiftInstanceType.SERVERLESS

        # Create instance without full initialization
        lineage_source = RedshiftLineageSource.__new__(RedshiftLineageSource)
        lineage_source.engine = self.mock_engine
        lineage_source.redshift_instance_type = mock_get_instance_type.return_value

        # Simulate __init__ logic for filter and statement selection
        if lineage_source.redshift_instance_type == RedshiftInstanceType.SERVERLESS:
            lineage_source.sql_stmt = REDSHIFT_SQL_STATEMENT_MAP[
                RedshiftInstanceType.SERVERLESS
            ]
            lineage_source.filters = RedshiftLineageSource.serverless_filters

        # Verify instance type
        self.assertEqual(
            lineage_source.redshift_instance_type, RedshiftInstanceType.SERVERLESS
        )

        # Verify SQL statement
        self.assertEqual(
            lineage_source.sql_stmt,
            REDSHIFT_SQL_STATEMENT_MAP[RedshiftInstanceType.SERVERLESS],
        )

        # CRITICAL: Verify filters use 'query_text' (not 'querytxt')
        self.assertIn("query_text", lineage_source.filters)
        self.assertNotIn("querytxt", lineage_source.filters)

        # Verify lineage-specific patterns with query_type column
        self.assertIn("ILIKE '%%create%%table%%as%%select%%'", lineage_source.filters)
        self.assertIn("query_type = 'CTAS'", lineage_source.filters)
        self.assertIn("ILIKE '%%insert%%into%%select%%'", lineage_source.filters)
        self.assertIn("query_type = 'INSERT'", lineage_source.filters)
        self.assertIn("ILIKE '%%update%%'", lineage_source.filters)
        self.assertIn("query_type = 'UPDATE'", lineage_source.filters)
        self.assertIn("ILIKE '%%merge%%'", lineage_source.filters)
        self.assertIn("query_type = 'MERGE'", lineage_source.filters)


if __name__ == "__main__":
    unittest.main()
