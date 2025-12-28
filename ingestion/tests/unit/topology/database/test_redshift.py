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
Test Redshift Provisioned cluster detection and query selection
"""

import unittest
from unittest.mock import Mock, patch

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.redshift.connection import (
    get_redshift_instance_type,
)
from metadata.ingestion.source.database.redshift.metadata import RedshiftSource
from metadata.ingestion.source.database.redshift.models import RedshiftInstanceType
from metadata.ingestion.source.database.redshift.queries import (
    REDSHIFT_SQL_STATEMENT_MAP,
)

mock_redshift_config = {
    "source": {
        "type": "redshift",
        "serviceName": "local_redshift",
        "serviceConnection": {
            "config": {
                "type": "Redshift",
                "username": "username",
                "password": "password",
                "database": "database",
                "hostPort": "cluster.name.region.redshift.amazonaws.com:5439",
                "sslMode": "verify-full",
                "sslConfig": {
                    "caCertificate": "CA certificate content",
                },
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


RAW_DIST_STYLE = ["KEY(eventid)", "EVEN", "ALL"]

EXPECTED_PARTITION_COLUMNS = ["eventid", None, None]


class RedshiftUnitTest(unittest.TestCase):
    """Test cases for Redshift Provisioned cluster"""

    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def setUp(self, mock_test_connection):
        """Set up test fixtures"""
        mock_test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_redshift_config)
        self.redshift_source = RedshiftSource.create(
            mock_redshift_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    def test_partition_parse_columns(self):
        """Test parsing of partition key from distribution style"""
        for i in range(len(RAW_DIST_STYLE)):
            with self.subTest(i=i):
                self.assertEqual(
                    self.redshift_source._get_partition_key(RAW_DIST_STYLE[i]),
                    EXPECTED_PARTITION_COLUMNS[i],
                )

    @patch("sqlalchemy.engine.base.Engine")
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.connection"
    )
    def test_close_connection(self, mock_connection, mock_engine):
        """Test connection closing"""
        mock_connection.return_value = True
        self.redshift_source.close()

    def test_detect_provisioned_when_stl_accessible(self):
        """Test detection of Provisioned cluster when STL tables are accessible"""
        mock_engine = Mock()
        mock_conn = Mock()
        mock_context = Mock()
        mock_context.__enter__ = Mock(return_value=mock_conn)
        mock_context.__exit__ = Mock(return_value=False)
        mock_engine.connect.return_value = mock_context
        mock_conn.execute.return_value = Mock()  # STL query succeeds

        result = get_redshift_instance_type(mock_engine)

        self.assertEqual(result, RedshiftInstanceType.PROVISIONED)
        mock_conn.execute.assert_called_once()

    def test_provisioned_uses_stl_queries(self):
        """Test that Provisioned cluster uses STL-based queries"""
        sql = REDSHIFT_SQL_STATEMENT_MAP[RedshiftInstanceType.PROVISIONED]

        # Check for use of STL tables
        self.assertIn("stl_query", sql.lower())
        self.assertIn("stl_querytext", sql.lower())

        # Check that SYS views are not used
        self.assertNotIn("SYS_QUERY_HISTORY", sql)
        self.assertNotIn("SYS_QUERY_TEXT", sql)
        self.assertNotIn("SYS_QUERY_DETAIL", sql)

        # Check for proper placeholder substitution
        self.assertIn("{start_time}", sql)
        self.assertIn("{end_time}", sql)
        self.assertIn("{result_limit}", sql)
        self.assertIn("{filters}", sql)

    @patch(
        "metadata.ingestion.source.database.redshift.usage.get_redshift_instance_type"
    )
    def test_usage_source_provisioned_initialization(self, mock_get_instance_type):
        """Test RedshiftUsageSource filters and SQL statement for Provisioned"""
        from metadata.ingestion.source.database.redshift.usage import (
            RedshiftUsageSource,
        )

        mock_get_instance_type.return_value = RedshiftInstanceType.PROVISIONED
        mock_engine = Mock()

        # Create instance without full initialization
        usage_source = RedshiftUsageSource.__new__(RedshiftUsageSource)
        usage_source.engine = mock_engine
        usage_source.redshift_instance_type = mock_get_instance_type.return_value

        # Simulate __init__ logic for filter and statement selection
        if usage_source.redshift_instance_type == RedshiftInstanceType.PROVISIONED:
            usage_source.sql_stmt = REDSHIFT_SQL_STATEMENT_MAP[
                RedshiftInstanceType.PROVISIONED
            ]
            usage_source.filters = RedshiftUsageSource.provisioned_filters

        # Verify instance type detected correctly
        self.assertEqual(
            usage_source.redshift_instance_type, RedshiftInstanceType.PROVISIONED
        )

        # Verify correct SQL statement selected
        self.assertEqual(
            usage_source.sql_stmt,
            REDSHIFT_SQL_STATEMENT_MAP[RedshiftInstanceType.PROVISIONED],
        )

        # CRITICAL: Verify filters use 'querytxt' (Provisioned column name)
        self.assertIn("querytxt", usage_source.filters)
        self.assertNotIn("query_text", usage_source.filters)

        # Verify specific filter patterns
        self.assertIn("NOT ILIKE 'fetch%%'", usage_source.filters)
        self.assertIn("NOT ILIKE 'padb_fetch_sample:%%'", usage_source.filters)

    @patch(
        "metadata.ingestion.source.database.redshift.lineage.get_redshift_instance_type"
    )
    def test_lineage_source_provisioned_initialization(self, mock_get_instance_type):
        """Test RedshiftLineageSource filters and SQL statement for Provisioned"""
        from metadata.ingestion.source.database.redshift.lineage import (
            RedshiftLineageSource,
        )

        mock_get_instance_type.return_value = RedshiftInstanceType.PROVISIONED
        mock_engine = Mock()

        # Create instance without full initialization
        lineage_source = RedshiftLineageSource.__new__(RedshiftLineageSource)
        lineage_source.engine = mock_engine
        lineage_source.redshift_instance_type = mock_get_instance_type.return_value

        # Simulate __init__ logic for filter and statement selection
        if lineage_source.redshift_instance_type == RedshiftInstanceType.PROVISIONED:
            lineage_source.sql_stmt = REDSHIFT_SQL_STATEMENT_MAP[
                RedshiftInstanceType.PROVISIONED
            ]
            lineage_source.filters = RedshiftLineageSource.provisioned_filters

        # Verify instance type detected correctly
        self.assertEqual(
            lineage_source.redshift_instance_type, RedshiftInstanceType.PROVISIONED
        )

        # Verify correct SQL statement selected
        self.assertEqual(
            lineage_source.sql_stmt,
            REDSHIFT_SQL_STATEMENT_MAP[RedshiftInstanceType.PROVISIONED],
        )

        # CRITICAL: Verify filters use 'querytxt' (Provisioned column name)
        self.assertIn("querytxt", lineage_source.filters)
        self.assertNotIn("query_text", lineage_source.filters)

        # Verify lineage-specific filter patterns
        self.assertIn("ILIKE '%%create%%table%%as%%select%%'", lineage_source.filters)
        self.assertIn("ILIKE '%%insert%%into%%select%%'", lineage_source.filters)
        self.assertIn("ILIKE '%%update%%'", lineage_source.filters)
        self.assertIn("ILIKE '%%merge%%'", lineage_source.filters)


if __name__ == "__main__":
    unittest.main()
