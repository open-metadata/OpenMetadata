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
Test Hive Postgres Metastore Dialect
"""

from unittest.mock import MagicMock, Mock

from metadata.ingestion.source.database.hive.metastore_dialects.postgres.dialect import (
    HivePostgresMetaStoreDialect,
)


class TestHivePostgresMetastoreDialectGetTableNames:
    """
    Test get_table_names null-safe filtering in HivePostgresMetaStoreDialect.

    In SQL, NULL != 'VIRTUAL_VIEW' evaluates to NULL (not TRUE), so rows with
    a NULL TBL_TYPE would be silently excluded without the IS NULL guard.
    """

    def setup_method(self):
        self.dialect = HivePostgresMetaStoreDialect()

    def test_get_table_names_query_excludes_virtual_views(self):
        mock_connection = Mock()
        mock_connection.execute.return_value = [("table1",), ("table2",)]

        result = self.dialect.get_table_names(mock_connection, schema="test_schema")

        executed_query = str(mock_connection.execute.call_args[0][0])
        assert "VIRTUAL_VIEW" in executed_query
        assert "!=" in executed_query
        assert result == ["table1", "table2"]

    def test_get_table_names_query_includes_null_tbl_type(self):
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


class TestHivePostgresMetastoreDialectGetTableColumns:
    """
    Test _get_table_columns in HivePostgresMetaStoreDialect.
    Postgres dialect uses CTE (WITH clause) which is valid for all Postgres versions.
    """

    def setup_method(self):
        self.dialect = HivePostgresMetaStoreDialect()

    def test_get_table_columns_uses_cte(self):
        mock_connection = Mock()
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [
            ("col1", "text", "First column"),
            ("col2", "integer", "Second column"),
        ]
        mock_connection.execute.return_value = mock_result

        result = self.dialect._get_table_columns(
            mock_connection, "test_table", "test_schema"
        )

        executed_query = str(mock_connection.execute.call_args[0][0])
        assert "WITH" in executed_query.upper()
        assert "UNION ALL" in executed_query.upper()
        assert len(result) == 2

    def test_get_table_columns_with_schema(self):
        mock_connection = Mock()
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [("col1", "text", None)]
        mock_connection.execute.return_value = mock_result

        self.dialect._get_table_columns(mock_connection, "test_table", "test_schema")

        executed_query = str(mock_connection.execute.call_args[0][0])
        assert "test_schema" in executed_query
        assert '"DBS"' in executed_query

    def test_get_table_columns_without_schema(self):
        mock_connection = Mock()
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [("col1", "text", None)]
        mock_connection.execute.return_value = mock_result

        self.dialect._get_table_columns(mock_connection, "test_table", None)

        executed_query = str(mock_connection.execute.call_args[0][0])
        assert "test_table" in executed_query
        assert '"COLUMNS_V2"' in executed_query
        assert '"PARTITION_KEYS"' in executed_query

    def test_get_table_columns_uses_quoted_identifiers(self):
        """Postgres dialect uses double-quoted identifiers for case-sensitivity."""
        mock_connection = Mock()
        mock_result = MagicMock()
        mock_result.fetchall.return_value = []
        mock_connection.execute.return_value = mock_result

        self.dialect._get_table_columns(mock_connection, "test_table", "test_schema")

        executed_query = str(mock_connection.execute.call_args[0][0])
        assert '"COLUMN_NAME"' in executed_query
        assert '"TYPE_NAME"' in executed_query
        assert '"TBLS"' in executed_query

    def test_get_table_columns_contains_both_selects(self):
        mock_connection = Mock()
        mock_result = MagicMock()
        mock_result.fetchall.return_value = []
        mock_connection.execute.return_value = mock_result

        self.dialect._get_table_columns(mock_connection, "test_table", "test_schema")

        executed_query = str(mock_connection.execute.call_args[0][0])
        assert '"COLUMNS_V2"' in executed_query
        assert '"PARTITION_KEYS"' in executed_query
        assert '"PKEY_NAME"' in executed_query
        assert '"PKEY_TYPE"' in executed_query
        assert '"PKEY_COMMENT"' in executed_query
