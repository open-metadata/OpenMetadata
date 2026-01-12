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
from metadata.ingestion.source.database.greenplum.queries import (
    GREENPLUM_GET_TABLE_NAMES,
    GREENPLUM_GET_TABLE_NAMES_V7,
    GREENPLUM_PARTITION_DETAILS,
    GREENPLUM_PARTITION_DETAILS_V7,
)

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


class GreenplumVersionDetectionTest(TestCase):
    """Test Greenplum version detection and query selection"""

    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def setUp(self, test_connection):
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_greenplum_config)
        self.greenplum_source = GreenplumSource.create(
            mock_greenplum_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    def test_is_greenplum_v7_with_pg12(self):
        """Test that Greenplum 7 (based on PostgreSQL 12) is correctly detected"""
        self.greenplum_source.engine = MagicMock()
        self.greenplum_source.engine.dialect.server_version_info = (12, 0, 0)
        self.assertTrue(self.greenplum_source._is_greenplum_v7())

    def test_is_greenplum_v7_with_pg14(self):
        """Test that higher PostgreSQL versions are detected as Greenplum 7+"""
        self.greenplum_source.engine = MagicMock()
        self.greenplum_source.engine.dialect.server_version_info = (14, 0, 0)
        self.assertTrue(self.greenplum_source._is_greenplum_v7())

    def test_is_not_greenplum_v7_with_pg94(self):
        """Test that Greenplum 6 (based on PostgreSQL 9.4) is correctly detected"""
        self.greenplum_source.engine = MagicMock()
        self.greenplum_source.engine.dialect.server_version_info = (9, 4, 26)
        self.assertFalse(self.greenplum_source._is_greenplum_v7())

    def test_is_not_greenplum_v7_with_pg11(self):
        """Test that PostgreSQL 11 is detected as not Greenplum 7"""
        self.greenplum_source.engine = MagicMock()
        self.greenplum_source.engine.dialect.server_version_info = (11, 0, 0)
        self.assertFalse(self.greenplum_source._is_greenplum_v7())

    def test_v7_queries_use_relispartition(self):
        """Verify the V7 table query uses relispartition"""
        self.assertIn("relispartition", GREENPLUM_GET_TABLE_NAMES_V7)
        self.assertNotIn("pg_partition_rule", GREENPLUM_GET_TABLE_NAMES_V7)

    def test_v6_queries_use_pg_partition_rule(self):
        """Verify the V6 table query uses pg_partition_rule"""
        self.assertIn("pg_partition_rule", GREENPLUM_GET_TABLE_NAMES)
        self.assertNotIn("relispartition", GREENPLUM_GET_TABLE_NAMES)

    def test_v7_partition_details_use_pg_partitioned_table(self):
        """Verify the V7 partition details query uses pg_partitioned_table"""
        self.assertIn("pg_partitioned_table", GREENPLUM_PARTITION_DETAILS_V7)
        # Ensure it doesn't use the legacy pg_catalog.pg_partition table
        self.assertNotIn("pg_catalog.pg_partition", GREENPLUM_PARTITION_DETAILS_V7)

    def test_v6_partition_details_use_pg_partition(self):
        """Verify the V6 partition details query uses pg_partition"""
        self.assertIn("pg_catalog.pg_partition", GREENPLUM_PARTITION_DETAILS)
        self.assertNotIn("pg_partitioned_table", GREENPLUM_PARTITION_DETAILS)
