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
Test Greenplum using the topology
"""

from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.greenplum.metadata import GreenplumSource

mock_greenplum_config = {
    "source": {
        "type": "greenplum",
        "serviceName": "local_greenplum1",
        "serviceConnection": {
            "config": {
                "type": "Greenplum",
                "username": "username",
                "authType": {
                    "password": "password",
                },
                "hostPort": "localhost:5432",
                "database": "greenplum",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
            }
        },
    },
    "sink": {
        "type": "metadata-rest",
        "config": {},
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "greenplum"},
        }
    },
}


class greenplumUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_greenplum_config)
        self.greenplum_source = GreenplumSource.create(
            mock_greenplum_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    @patch("sqlalchemy.engine.base.Engine")
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.connection"
    )
    def test_close_connection(self, engine, connection):
        connection.return_value = True
        self.greenplum_source.close()

    @patch("sqlalchemy.engine.base.Engine.connect")
    def test_is_gp7_returns_true_for_pg12(self, mock_connect):
        """Version detection returns True for PostgreSQL 12+ (Greenplum 7.x)"""
        mock_conn = MagicMock()
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=False)
        mock_conn.execute.return_value.fetchone.return_value = ("12.12",)
        mock_connect.return_value = mock_conn
        # Clear cache if exists
        if hasattr(self.greenplum_source, "_gp7_cache"):
            del self.greenplum_source._gp7_cache
        self.assertTrue(self.greenplum_source._is_gp7())

    @patch("sqlalchemy.engine.base.Engine.connect")
    def test_is_gp7_returns_false_for_pg9(self, mock_connect):
        """Version detection returns False for PostgreSQL 9.x (Greenplum 6.x)"""
        mock_conn = MagicMock()
        mock_conn.__enter__ = MagicMock(return_value=mock_conn)
        mock_conn.__exit__ = MagicMock(return_value=False)
        mock_conn.execute.return_value.fetchone.return_value = ("9.4.26",)
        mock_connect.return_value = mock_conn
        if hasattr(self.greenplum_source, "_gp7_cache"):
            del self.greenplum_source._gp7_cache
        self.assertFalse(self.greenplum_source._is_gp7())

    @patch(
        "metadata.ingestion.source.database.greenplum.metadata"
        ".GreenplumSource._is_gp7",
        return_value=True,
    )
    @patch(
        "metadata.ingestion.source.database.common_db_source"
        ".CommonDbSourceService.connection"
    )
    def test_query_table_names_uses_gp7_query(
        self, mock_connection, mock_is_gp7
    ):
        """GP7 query uses relispartition instead of pg_partition_rule"""
        mock_connection.execute.return_value = [("test_table", "r")]
        result = list(
            self.greenplum_source.query_table_names_and_types("public")
        )
        call_args = mock_connection.execute.call_args
        query_str = str(call_args[0][0])
        self.assertIn("relispartition", query_str)
        self.assertNotIn("pg_partition_rule", query_str)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].name, "test_table")

    @patch(
        "metadata.ingestion.source.database.greenplum.metadata"
        ".GreenplumSource._is_gp7",
        return_value=False,
    )
    @patch(
        "metadata.ingestion.source.database.common_db_source"
        ".CommonDbSourceService.connection"
    )
    def test_query_table_names_uses_gp6_query(
        self, mock_connection, mock_is_gp7
    ):
        """GP6 query uses pg_partition_rule for backward compatibility"""
        mock_connection.execute.return_value = [("test_table", "r")]
        result = list(
            self.greenplum_source.query_table_names_and_types("public")
        )
        call_args = mock_connection.execute.call_args
        query_str = str(call_args[0][0])
        self.assertIn("pg_partition_rule", query_str)
        self.assertNotIn("relispartition", query_str)

    @patch("sqlalchemy.engine.base.Engine.connect")
    def test_is_gp7_defaults_to_false_on_error(self, mock_connect):
        """Version detection falls back to GP6 when connection fails"""
        mock_connect.side_effect = Exception("connection failed")
        if hasattr(self.greenplum_source, "_gp7_cache"):
            del self.greenplum_source._gp7_cache
        self.assertFalse(self.greenplum_source._is_gp7())
