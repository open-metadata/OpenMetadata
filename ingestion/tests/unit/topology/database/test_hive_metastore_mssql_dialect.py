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
Test Hive MSSQL Metastore Dialect
"""
from unittest.mock import MagicMock, Mock

from metadata.ingestion.source.database.hive.metastore_dialects.mssql.dialect import (
    HiveMssqlMetaStoreDialect,
)


class TestHiveMssqlMetastoreDialectGetTableColumns:
    """
    MSSQL supports CTEs (unlike MySQL 5.7), so the dialect uses WITH clauses
    and unquoted identifiers (MSSQL does not require quoting for standard names).
    """

    def setup_method(self):
        self.dialect = HiveMssqlMetaStoreDialect()

    def test_get_table_columns_uses_cte(self):
        """MSSQL dialect uses WITH … AS (CTE) — unlike MySQL which uses UNION ALL only."""
        mock_connection = Mock()
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [
            ("col1", "nvarchar", "First column"),
            ("col2", "int", "Second column"),
            ("part_col", "nvarchar", "Partition column"),
        ]
        mock_connection.execute.return_value = mock_result

        result = self.dialect._get_table_columns(
            mock_connection, "test_table", "test_schema"
        )

        executed_query = str(mock_connection.execute.call_args[0][0])
        assert "WITH" in executed_query.upper()
        assert "UNION ALL" in executed_query.upper()
        assert len(result) == 3

    def test_get_table_columns_without_schema(self):
        """Without schema, the DBS join should be absent."""
        mock_connection = Mock()
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [("col1", "nvarchar", None)]
        mock_connection.execute.return_value = mock_result

        self.dialect._get_table_columns(mock_connection, "test_table", None)

        executed_query = str(mock_connection.execute.call_args[0][0])
        assert "test_table" in executed_query
        assert "DBS" not in executed_query

    def test_get_table_columns_with_schema_joins_dbs(self):
        mock_connection = Mock()
        mock_result = MagicMock()
        mock_result.fetchall.return_value = []
        mock_connection.execute.return_value = mock_result

        self.dialect._get_table_columns(mock_connection, "test_table", "my_schema")

        executed_query = str(mock_connection.execute.call_args[0][0])
        assert "my_schema" in executed_query
        assert "DBS" in executed_query

    def test_get_table_columns_query_structure(self):
        """Query must reference both regular and partition column tables."""
        mock_connection = Mock()
        mock_result = MagicMock()
        mock_result.fetchall.return_value = []
        mock_connection.execute.return_value = mock_result

        self.dialect._get_table_columns(mock_connection, "test_table", "test_schema")

        executed_query = str(mock_connection.execute.call_args[0][0])
        assert "COLUMNS_V2" in executed_query
        assert "PARTITION_KEYS" in executed_query
        assert "PKEY_NAME" in executed_query
        assert "PKEY_TYPE" in executed_query
        assert "PKEY_COMMENT" in executed_query
        assert executed_query.upper().count("SELECT") == 2

    def test_get_table_columns_uses_unquoted_identifiers(self):
        """MSSQL dialect uses unquoted identifiers, not double-quoted like Postgres."""
        mock_connection = Mock()
        mock_result = MagicMock()
        mock_result.fetchall.return_value = []
        mock_connection.execute.return_value = mock_result

        self.dialect._get_table_columns(mock_connection, "test_table", "test_schema")

        executed_query = str(mock_connection.execute.call_args[0][0])
        # Should NOT use Postgres-style double-quoted identifiers
        assert '"COLUMN_NAME"' not in executed_query
        assert '"TBLS"' not in executed_query
        # Should use plain unquoted identifiers
        assert "COLUMN_NAME" in executed_query
        assert "TBLS" in executed_query


class TestHiveMssqlMetastoreDialectGetTableNames:
    """
    Null-safe TBL_TYPE filtering: NULL != 'VIRTUAL_VIEW' evaluates to NULL in SQL,
    so rows with a NULL TBL_TYPE would be excluded without the IS NULL guard.
    """

    def setup_method(self):
        self.dialect = HiveMssqlMetaStoreDialect()

    def test_get_table_names_query_excludes_virtual_views(self):
        mock_connection = Mock()
        mock_connection.execute.return_value = [("table1",), ("table2",)]

        result = self.dialect.get_table_names(mock_connection, schema="test_schema")

        executed_query = str(mock_connection.execute.call_args[0][0])
        assert "VIRTUAL_VIEW" in executed_query
        assert "!=" in executed_query
        assert result == ["table1", "table2"]

    def test_get_table_names_query_includes_null_tbl_type(self):
        """IS NULL guard ensures tables without a TBL_TYPE are included."""
        mock_connection = Mock()
        mock_connection.execute.return_value = []

        self.dialect.get_table_names(mock_connection, schema="test_schema")

        executed_query = str(mock_connection.execute.call_args[0][0])
        assert "IS NULL" in executed_query.upper()
        assert "TBL_TYPE" in executed_query

    def test_get_table_names_query_uses_or_condition(self):
        mock_connection = Mock()
        mock_connection.execute.return_value = []

        self.dialect.get_table_names(mock_connection, schema="test_schema")

        executed_query = str(mock_connection.execute.call_args[0][0])
        assert "OR" in executed_query.upper()
        assert "TBL_TYPE" in executed_query
        assert "VIRTUAL_VIEW" in executed_query
        assert "IS NULL" in executed_query.upper()

    def test_get_table_names_with_schema_joins_dbs(self):
        mock_connection = Mock()
        mock_connection.execute.return_value = [("my_table",)]

        result = self.dialect.get_table_names(mock_connection, schema="my_schema")

        executed_query = str(mock_connection.execute.call_args[0][0])
        assert "DBS" in executed_query
        assert "my_schema" in executed_query
        assert result == ["my_table"]

    def test_get_table_names_without_schema(self):
        mock_connection = Mock()
        mock_connection.execute.return_value = [("table_a",)]

        result = self.dialect.get_table_names(mock_connection, schema=None)

        executed_query = str(mock_connection.execute.call_args[0][0])
        assert "TBL_TYPE" in executed_query
        assert "IS NULL" in executed_query.upper()
        assert "DBS" not in executed_query
        assert result == ["table_a"]

    def test_get_table_names_returns_empty_when_no_tables(self):
        mock_connection = Mock()
        mock_connection.execute.return_value = []

        result = self.dialect.get_table_names(mock_connection, schema="empty_schema")

        assert result == []

    def test_get_schema_names_uses_unquoted_identifiers(self):
        """MSSQL schema names query uses unquoted NAME column."""
        mock_connection = Mock()
        mock_connection.execute.return_value = [("db1",), ("db2",)]

        result = self.dialect.get_schema_names(mock_connection)

        executed_query = str(mock_connection.execute.call_args[0][0])
        assert "NAME" in executed_query
        assert "DBS" in executed_query
        # MSSQL uses plain unquoted names, not Postgres-style "NAME"
        assert '"NAME"' not in executed_query
        assert result == ["db1", "db2"]
