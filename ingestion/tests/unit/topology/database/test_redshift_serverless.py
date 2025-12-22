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
Test Redshift Serverless functionality
"""

from unittest import TestCase
from unittest.mock import Mock

from sqlalchemy.exc import ProgrammingError

from metadata.ingestion.source.database.redshift.connection import (
    get_redshift_instance_type,
)
from metadata.ingestion.source.database.redshift.models import RedshiftInstanceType
from metadata.ingestion.source.database.redshift.queries import (
    REDSHIFT_GET_STORED_PROCEDURE_QUERIES_MAP,
    REDSHIFT_SQL_STATEMENT_MAP,
    REDSHIFT_SYSTEM_METRICS_QUERY_MAP,
)


class TestRedshiftServerlessInstance(TestCase):
    """Test Redshift Serverless instance type detection and query selection"""

    def test_detect_serverless_when_stl_not_accessible(self):
        """Verify Serverless is detected when STL tables fail"""
        mock_engine = Mock()
        mock_conn = Mock()
        mock_context = Mock()
        mock_context.__enter__ = Mock(return_value=mock_conn)
        mock_context.__exit__ = Mock(return_value=False)
        mock_engine.connect.return_value = mock_context
        mock_conn.execute.side_effect = ProgrammingError(
            "relation does not exist", params=None, orig=None
        )

        result = get_redshift_instance_type(mock_engine)

        self.assertEqual(result, RedshiftInstanceType.SERVERLESS)

    def test_serverless_uses_sys_queries(self):
        """Verify Serverless uses SYS views not STL tables"""
        sql = REDSHIFT_SQL_STATEMENT_MAP[RedshiftInstanceType.SERVERLESS]

        self.assertIn("SYS_QUERY_HISTORY", sql)
        self.assertIn("SYS_QUERY_DETAIL", sql)
        self.assertNotIn("stl_query", sql.lower())

    def test_serverless_stored_procedures_use_sys(self):
        """Verify Serverless stored procedures use SYS views"""
        query = REDSHIFT_GET_STORED_PROCEDURE_QUERIES_MAP[
            RedshiftInstanceType.SERVERLESS
        ]

        self.assertIn("SYS_PROCEDURE_CALL", query)
        self.assertIn("SYS_QUERY_HISTORY", query)

    def test_serverless_system_metrics_use_sys(self):
        """Verify Serverless system metrics use SYS views"""
        query = REDSHIFT_SYSTEM_METRICS_QUERY_MAP[RedshiftInstanceType.SERVERLESS]

        self.assertIn("SYS_QUERY_DETAIL", query)
        self.assertNotIn("stl_insert", query.lower())
