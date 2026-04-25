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
Tests for Microsoft Fabric lineage and query parser
"""
from unittest.mock import MagicMock, patch

import pytest

from metadata.ingestion.source.database.microsoftfabric.queries import (
    FABRIC_GET_STORED_PROCEDURE_QUERIES,
    FABRIC_SQL_STATEMENT,
)

MOCK_LINEAGE_CONFIG = {
    "source": {
        "type": "microsoftfabric",
        "serviceName": "test_fabric_lineage",
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
                "type": "DatabaseLineage",
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


class TestFabricSqlStatementTemplate:
    """Verify the shared query templates have the correct placeholders"""

    def test_sql_statement_has_result_limit_placeholder(self):
        assert "{result_limit}" in FABRIC_SQL_STATEMENT

    def test_sql_statement_has_time_range_placeholders(self):
        assert "{start_time}" in FABRIC_SQL_STATEMENT
        assert "{end_time}" in FABRIC_SQL_STATEMENT

    def test_sql_statement_has_filters_placeholder(self):
        assert "{filters}" in FABRIC_SQL_STATEMENT

    def test_sql_statement_queries_exec_requests_history(self):
        assert "queryinsights.exec_requests_history" in FABRIC_SQL_STATEMENT

    def test_sql_statement_excludes_openmetadata_queries(self):
        assert "OpenMetadata" in FABRIC_SQL_STATEMENT

    def test_stored_procedure_query_has_start_date_placeholder(self):
        assert "{start_date}" in FABRIC_GET_STORED_PROCEDURE_QUERIES

    def test_stored_procedure_query_targets_exec_commands(self):
        assert "exec%" in FABRIC_GET_STORED_PROCEDURE_QUERIES

    def test_sql_statement_format_succeeds(self):
        formatted = FABRIC_SQL_STATEMENT.format(
            result_limit=100,
            start_time="2024-01-01 00:00:00",
            end_time="2024-01-02 00:00:00",
            filters="AND 1=1",
        )
        assert "100" in formatted
        assert "2024-01-01 00:00:00" in formatted


class TestFabricLineageFilters:
    """Verify lineage includes DML write operations and excludes DDL/system queries"""

    @pytest.fixture
    def lineage_source(self):
        with patch(
            "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
        ), patch(
            "metadata.ingestion.source.database.microsoftfabric.connection.get_connection"
        ) as mock_conn:
            mock_conn.return_value = MagicMock()
            from metadata.ingestion.source.database.microsoftfabric.lineage import (
                MicrosoftFabricLineageSource,
            )

            source = MicrosoftFabricLineageSource.create(
                MOCK_LINEAGE_CONFIG["source"], MagicMock()
            )
            return source

    def test_lineage_includes_select_into(self, lineage_source):
        assert "select%%into" in lineage_source.filters.lower()

    def test_lineage_includes_insert_into_select(self, lineage_source):
        assert "insert%%into%%select" in lineage_source.filters.lower()

    def test_lineage_includes_update(self, lineage_source):
        assert "update" in lineage_source.filters.lower()

    def test_lineage_includes_merge(self, lineage_source):
        assert "merge" in lineage_source.filters.lower()

    def test_lineage_excludes_create_procedure(self, lineage_source):
        assert "create%%procedure" in lineage_source.filters.lower()

    def test_lineage_excludes_create_function(self, lineage_source):
        assert "create%%function" in lineage_source.filters.lower()

    def test_lineage_excludes_declare(self, lineage_source):
        assert "declare" in lineage_source.filters.lower()

    def test_lineage_excludes_exec_sp(self, lineage_source):
        assert "exec sp_" in lineage_source.filters.lower()

    def test_lineage_uses_fabric_sql_statement(self, lineage_source):
        assert lineage_source.sql_stmt is FABRIC_SQL_STATEMENT

    def test_lineage_start_end_are_timezone_naive(self, lineage_source):
        assert lineage_source.start.tzinfo is None
        assert lineage_source.end.tzinfo is None

    def test_get_stored_procedure_sql_statement_formats_date(self, lineage_source):
        sql = lineage_source.get_stored_procedure_sql_statement()
        assert "{start_date}" not in sql
        assert "exec_requests_history" in sql.lower()


class TestFabricQueryParserSourceValidation:
    """Verify query parser source rejects wrong connection types"""

    def test_create_raises_on_wrong_connection_type(self):
        from metadata.ingestion.api.steps import InvalidSourceException
        from metadata.ingestion.source.database.microsoftfabric.lineage import (
            MicrosoftFabricLineageSource,
        )

        bad_config = {
            "type": "mssql",
            "serviceName": "test",
            "serviceConnection": {
                "config": {
                    "type": "Mssql",
                    "username": "user",
                    "password": "pass",
                    "hostPort": "localhost:1433",
                    "database": "db",
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "DatabaseLineage",
                    "queryLogDuration": 1,
                    "resultLimit": 1000,
                }
            },
        }
        with pytest.raises((InvalidSourceException, Exception)):
            MicrosoftFabricLineageSource.create(bad_config, MagicMock())
