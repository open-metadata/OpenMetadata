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
Test Exasol using the topology
"""

from datetime import datetime
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.exasol.metadata import ExasolSource
from metadata.ingestion.source.database.exasol.queries import EXASOL_SQL_STATEMENT
from metadata.ingestion.source.database.exasol.usage import ExasolUsageSource

mock_exasol_config = {
    "source": {
        "type": "exasol",
        "serviceName": "local_exasol1",
        "serviceConnection": {
            "config": {
                "type": "Exasol",
                "username": "username",
                "password": "password",
                "hostPort": "localhost:8563",
                "tls": "disable-tls",
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
            "securityConfig": {"jwtToken": "exasol"},
        }
    },
}


class ExasolUnitTest(TestCase):
    @patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection")
    def __init__(self, methodName, test_connection) -> None:  # noqa: N803
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.model_validate(mock_exasol_config)
        self.exasol_source = ExasolSource.create(
            mock_exasol_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    @patch("sqlalchemy.engine.base.Engine")
    @patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.connection")
    def test_close_connection(self, engine, connection):
        connection.return_value = True
        self.exasol_source.close()


class ExasolUsageTest(TestCase):
    def setUp(self):
        self.usage_source = ExasolUsageSource.__new__(ExasolUsageSource)
        self.usage_source.sql_stmt = EXASOL_SQL_STATEMENT
        self.usage_source.filters = ""
        self.usage_source.source_config = SimpleNamespace(resultLimit=250, filterCondition=None)

    def test_get_sql_statement(self):
        sql = self.usage_source.get_sql_statement(
            start_time=datetime(2025, 1, 1, 0, 0, 0),
            end_time=datetime(2025, 1, 2, 0, 0, 0),
        )

        assert "EXA_STATISTICS.EXA_DBA_AUDIT_SQL" in sql
        assert '"aborted"' not in sql
        assert "LIMIT 250" in sql
        assert "CONVERT_TZ(TO_TIMESTAMP('2025-01-01 00:00:00'), 'UTC', DBTIMEZONE)" in sql
        assert "CONVERT_TZ(TO_TIMESTAMP('2025-01-02 00:00:00'), 'UTC', DBTIMEZONE)" in sql
