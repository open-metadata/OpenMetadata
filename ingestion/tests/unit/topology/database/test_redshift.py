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
Test Redshift using the topology
"""

from unittest import TestCase
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


class RedshiftUnitTest(TestCase):
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_redshift_config)
        self.redshift_source = RedshiftSource.create(
            mock_redshift_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    def test_partition_parse_columns(self):
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
    def test_close_connection(self, engine, connection):
        connection.return_value = True
        self.redshift_source.close()

    def test_detect_provisioned_when_stl_accessible(self):
        """Verify Provisioned is detected when STL tables are accessible"""
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
        """Verify Provisioned uses STL-based queries"""
        sql = REDSHIFT_SQL_STATEMENT_MAP[RedshiftInstanceType.PROVISIONED]

        # Must use STL tables
        self.assertIn("stl_query", sql)
        self.assertIn("stl_querytext", sql)
