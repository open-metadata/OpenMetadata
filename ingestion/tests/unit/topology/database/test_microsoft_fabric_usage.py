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
Tests for Microsoft Fabric usage
"""

from unittest.mock import MagicMock, patch

import pytest

from metadata.ingestion.source.database.microsoftfabric.queries import (
    FABRIC_SQL_STATEMENT,
)

MOCK_USAGE_CONFIG = {
    "source": {
        "type": "microsoftfabric",
        "serviceName": "test_fabric_usage",
        "serviceConnection": {
            "config": {
                "type": "MicrosoftFabric",
                "tenantId": "test-tenant-id",
                "clientId": "test-client-id",
                "clientSecret": "test-client-secret",
                "hostPort": "test.datawarehouse.fabric.microsoft.com:1433",
                "database": "test_warehouse",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseUsage",
                "queryLogDuration": 1,
                "resultLimit": 1000,
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "fabric"},
        }
    },
}


class TestFabricUsageFilters:
    """Verify usage filters exclude DDL/system queries"""

    @pytest.fixture
    def usage_source(self):
        with (
            patch("metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"),
            patch("metadata.ingestion.source.database.microsoftfabric.connection.get_connection") as mock_conn,
        ):
            mock_conn.return_value = MagicMock()
            from metadata.ingestion.source.database.microsoftfabric.usage import (
                MicrosoftFabricUsageSource,
            )

            source = MicrosoftFabricUsageSource.create(MOCK_USAGE_CONFIG["source"], MagicMock())
            return source

    def test_usage_excludes_create_procedure(self, usage_source):
        assert "create%%procedure" in usage_source.filters.lower()

    def test_usage_excludes_create_function(self, usage_source):
        assert "create%%function" in usage_source.filters.lower()

    def test_usage_excludes_declare(self, usage_source):
        assert "declare" in usage_source.filters.lower()

    def test_usage_excludes_exec_sp(self, usage_source):
        assert "exec sp_" in usage_source.filters.lower()

    def test_usage_uses_fabric_sql_statement(self, usage_source):
        assert usage_source.sql_stmt is FABRIC_SQL_STATEMENT

    def test_usage_filters_differ_from_lineage(self, usage_source):
        from metadata.ingestion.source.database.microsoftfabric.lineage import (
            MicrosoftFabricLineageSource,
        )

        assert usage_source.filters != MicrosoftFabricLineageSource.filters
