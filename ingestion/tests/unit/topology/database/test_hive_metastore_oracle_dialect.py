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
Test Hive Oracle Metastore Dialect
"""

from unittest.mock import MagicMock, Mock

from metadata.ingestion.source.database.hive.metastore_dialects.oracle.dialect import (
    HiveOracleMetaStoreDialect,
)


class TestHiveOracleMetastoreDialectGetTableNames:
    """
    Oracle dialect uses double-quoted identifiers for case-insensitive column names,
    matching the Postgres dialect behaviour. NULL-safe TBL_TYPE filtering applies.
    """

    def setup_method(self):
        self.dialect = HiveOracleMetaStoreDialect()

    def test_get_table_names_query_excludes_virtual_views(self):
        mock_connection = Mock()
        mock_connection.execute.return_value = [("table1",), ("table2",)]

        result = self.dialect.get_table_names(mock_connection, schema="test_schema")

        executed_query = str(mock_connection.execute.call_args[0][0])
        assert "VIRTUAL_VIEW" in executed_query
        assert "!=" in executed_query
        assert result == ["table1", "table2"]
        assert mock_connection.execute.call_args[0][1] == {"schema": "test_schema"}

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
        assert ":schema" in executed_query
        assert result == ["my_table"]
        assert mock_connection.execute.call_args[0][1] == {"schema": "my_schema"}

    def test_get_table_names_without_schema(self):
        mock_connection = Mock()
        mock_connection.execute.return_value = [("table_a",)]

        result = self.dialect.get_table_names(mock_connection, schema=None)

        executed_query = str(mock_connection.execute.call_args[0][0])
        assert "TBL_TYPE" in executed_query
        assert "IS NULL" in executed_query.upper()
        assert "DBS" not in executed_query
        assert result == ["table_a"]
        assert mock_connection.execute.call_args[0][1] == {}

    def test_get_table_names_returns_empty_when_no_tables(self):
        mock_connection = Mock()
        mock_connection.execute.return_value = []

        result = self.dialect.get_table_names(mock_connection, schema="empty_schema")

        assert result == []

    def test_get_schema_names_uses_quoted_identifiers(self):
        """Oracle dialect uses double-quoted NAME to preserve case."""
        mock_connection = Mock()
        mock_connection.execute.return_value = [("db1",), ("db2",)]

        result = self.dialect.get_schema_names(mock_connection)

        executed_query = str(mock_connection.execute.call_args[0][0])
        assert '"NAME"' in executed_query
        assert '"DBS"' in executed_query
        assert result == ["db1", "db2"]


class TestHiveOracleMetastoreDialectGetTableColumns:
    """
    Oracle dialect uses CTE (WITH clause) and double-quoted identifiers,
    matching the Postgres dialect pattern.
    """

    def setup_method(self):
        self.dialect = HiveOracleMetaStoreDialect()

    def test_get_table_columns_uses_cte(self):
        mock_connection = Mock()
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [
            ("col1", "VARCHAR2", "First column"),
            ("col2", "NUMBER", "Second column"),
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
        mock_result.fetchall.return_value = [("col1", "VARCHAR2", None)]
        mock_connection.execute.return_value = mock_result

        self.dialect._get_table_columns(mock_connection, "test_table", "test_schema")

        executed_query = str(mock_connection.execute.call_args[0][0])
        assert ":schema" in executed_query
        assert '"DBS"' in executed_query
        assert mock_connection.execute.call_args[0][1] == {
            "schema": "test_schema",
            "table_name": "test_table",
        }

    def test_get_table_columns_without_schema(self):
        mock_connection = Mock()
        mock_result = MagicMock()
        mock_result.fetchall.return_value = [("col1", "VARCHAR2", None)]
        mock_connection.execute.return_value = mock_result

        self.dialect._get_table_columns(mock_connection, "test_table", None)

        executed_query = str(mock_connection.execute.call_args[0][0])
        assert ":table_name" in executed_query
        assert '"COLUMNS_V2"' in executed_query
        assert '"PARTITION_KEYS"' in executed_query
        assert mock_connection.execute.call_args[0][1] == {"table_name": "test_table"}

    def test_get_table_columns_uses_quoted_identifiers(self):
        """Oracle dialect uses double-quoted identifiers for case-sensitivity."""
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
        """Query must select from both COLUMNS_V2 and PARTITION_KEYS."""
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
