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

"""Test Trino Metadata"""

import unittest
from unittest.mock import Mock, patch

from trino.sqlalchemy.dialect import TrinoDialect

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.ingestion.source.database.trino.metadata import (
    MAX_COMMENT_TABLE_NAMES,
    TrinoSource,
    _get_columns,
    get_table_comment,
    get_view_definition,
)


class TestTrinoMetadata(unittest.TestCase):
    """Test Trino Metadata"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_connection = Mock()
        self.mock_self = Mock()
        # The real preparer, not a Mock: get_view_definition quotes through it, and a
        # Mock would make the assertions below pass against any quoting at all.
        self.mock_self.identifier_preparer = TrinoDialect().identifier_preparer
        self.mock_self._get_default_catalog_name.return_value = "test_catalog"
        self.mock_self._get_default_schema_name.return_value = "test_schema"

    def _set_execute_side_effect(self, primary_result, fallback_result=None):
        """Helper to mock connection.execute for primary and fallback queries"""
        results = iter([self._mock_result(primary_result), self._mock_result(fallback_result)])
        self.mock_connection.execute.side_effect = lambda *args, **kwargs: next(results)

    @staticmethod
    def _mock_result(scalar_value):
        """Create a mock result with a scalar() return value"""
        result = Mock()
        result.scalar.return_value = scalar_value
        return result

    def test_view_definition_prepends_create_view_for_select_only(self):
        """Test that a SELECT-only definition from information_schema gets CREATE VIEW prepended"""
        self._set_execute_side_effect("SELECT * FROM table1")

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result,
            'CREATE VIEW "test_catalog"."test_schema"."test_view" AS SELECT * FROM table1',
        )
        # Only primary query should be executed
        self.assertEqual(self.mock_connection.execute.call_count, 1)

    def test_view_definition_with_create_view_not_modified(self):
        """Test that a definition already containing CREATE VIEW is returned as-is"""
        self._set_execute_side_effect("CREATE VIEW test_catalog.test_schema.test_view AS SELECT * FROM table1")

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result,
            "CREATE VIEW test_catalog.test_schema.test_view AS SELECT * FROM table1",
        )
        self.assertEqual(self.mock_connection.execute.call_count, 1)

    def test_view_definition_with_create_or_replace_not_modified(self):
        """Test that CREATE OR REPLACE VIEW is not double-prefixed"""
        self._set_execute_side_effect("CREATE OR REPLACE VIEW test_view AS SELECT * FROM table1")

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(result, "CREATE OR REPLACE VIEW test_view AS SELECT * FROM table1")

    def test_view_definition_fallback_when_primary_returns_none(self):
        """Test that SHOW CREATE VIEW is used when information_schema returns None"""
        self._set_execute_side_effect(
            None,
            "CREATE VIEW test_catalog.test_schema.test_view AS SELECT * FROM table1",
        )

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result,
            "CREATE VIEW test_catalog.test_schema.test_view AS SELECT * FROM table1",
        )
        self.assertEqual(self.mock_connection.execute.call_count, 2)

    def test_view_definition_fallback_when_primary_returns_empty_string(self):
        """Test that fallback is used when information_schema returns empty string"""
        self._set_execute_side_effect(
            "",
            "CREATE VIEW test_catalog.test_schema.test_view AS SELECT 1",
        )

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(result, "CREATE VIEW test_catalog.test_schema.test_view AS SELECT 1")
        self.assertEqual(self.mock_connection.execute.call_count, 2)

    def test_view_definition_returns_none_when_both_queries_empty(self):
        """Test that None is returned when both queries return nothing"""
        self._set_execute_side_effect(None, None)

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertIsNone(result)

    def test_view_definition_fallback_permission_error_handled(self):
        """Test that a permission error on fallback is handled gracefully"""
        primary_result = self._mock_result(None)
        self.mock_connection.execute.side_effect = [
            primary_result,
            PermissionError("Access Denied"),
        ]

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertIsNone(result)

    def test_view_definition_without_catalog(self):
        """Test full_view_name without catalog when catalog is None"""
        self.mock_self._get_default_catalog_name.return_value = None

        self._set_execute_side_effect("SELECT * FROM table1")

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result,
            'CREATE VIEW "test_schema"."test_view" AS SELECT * FROM table1',
        )

    def test_view_definition_uses_default_schema(self):
        """Test that schema falls back to _get_default_schema_name"""
        self._set_execute_side_effect("SELECT 1")

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
        )

        self.assertEqual(
            result,
            'CREATE VIEW "test_catalog"."test_schema"."test_view" AS SELECT 1',
        )

    def test_view_definition_raises_error_when_schema_none(self):
        """Test that NoSuchTableError is raised when schema is None"""
        from sqlalchemy import exc

        self.mock_self._get_default_schema_name.return_value = None

        with self.assertRaises(exc.NoSuchTableError):
            get_view_definition(
                self.mock_self,
                self.mock_connection,
                "test_view",
                schema=None,
            )


class TestTrinoIcebergDetection:
    def _make_mock_source(self, connector_name, table_names):
        mock_self = Mock()
        mock_self.context.get.return_value.database = "test_catalog"
        mock_result = Mock()
        mock_result.first.return_value = (connector_name,) if connector_name else None
        mock_self.connection.execute.return_value = mock_result
        mock_self.inspector.get_table_names.return_value = table_names
        return mock_self

    def test_iceberg_catalog_returns_iceberg_type(self):
        mock_self = self._make_mock_source("iceberg", ["orders", "customers"])
        result = TrinoSource.query_table_names_and_types(mock_self, "test_schema")
        assert result == [
            TableNameAndType(name="orders", type_=TableType.Iceberg),
            TableNameAndType(name="customers", type_=TableType.Iceberg),
        ]

    def test_non_iceberg_catalog_returns_regular_type(self):
        mock_self = self._make_mock_source("hive", ["orders"])
        result = TrinoSource.query_table_names_and_types(mock_self, "test_schema")
        assert result == [TableNameAndType(name="orders", type_=TableType.Regular)]

    def test_delta_lake_catalog_returns_delta_lake_type(self):
        mock_self = self._make_mock_source("delta_lake", ["delta_sales", "delta_events"])
        result = TrinoSource.query_table_names_and_types(mock_self, "test_schema")
        assert result == [
            TableNameAndType(name="delta_sales", type_=TableType.DeltaLake),
            TableNameAndType(name="delta_events", type_=TableType.DeltaLake),
        ]

    def test_hive_catalog_does_not_return_delta_lake_type(self):
        mock_self = self._make_mock_source("hive", ["hive_orders"])
        result = TrinoSource.query_table_names_and_types(mock_self, "test_schema")
        assert result == [TableNameAndType(name="hive_orders", type_=TableType.Regular)]

    def test_delta_substring_connector_is_not_delta_lake(self):
        """`delta` is Presto's connector name, not Trino's; Trino must not match it."""
        mock_self = self._make_mock_source("delta", ["t1"])
        result = TrinoSource.query_table_names_and_types(mock_self, "test_schema")
        assert result == [TableNameAndType(name="t1", type_=TableType.Regular)]

    def test_connection_error_falls_back_to_regular(self):
        mock_self = Mock()
        mock_self.context.get.return_value.database = "test_catalog"
        mock_self.connection.execute.side_effect = Exception("permission denied")
        mock_self.inspector.get_table_names.return_value = ["orders"]
        result = TrinoSource.query_table_names_and_types(mock_self, "test_schema")
        assert result == [TableNameAndType(name="orders", type_=TableType.Regular)]


class TestTrinoColumnComments:
    """`SHOW COLUMNS` reports an unset column comment as '', which must not become a description"""

    @staticmethod
    def _mock_connection(records):
        connection = Mock()
        connection.dialect.identifier_preparer.quote.side_effect = lambda value: f'"{value}"'
        connection.execute.return_value = records
        return connection

    @staticmethod
    def _record(name, comment):
        record = Mock()
        record.Column = name
        record.Type = "varchar"
        record.Comment = comment
        return record

    def _columns_for(self, records):
        mock_self = Mock()
        mock_self._get_default_schema_name.return_value = "test_schema"
        return _get_columns(mock_self, self._mock_connection(records), "test_table", "test_schema")

    def test_unset_comment_is_none(self):
        columns = self._columns_for([self._record("id", "")])
        assert columns[0]["comment"] is None

    def test_populated_comment_is_preserved(self):
        columns = self._columns_for([self._record("name", "Name of the student")])
        assert columns[0]["comment"] == "Name of the student"

    def test_null_comment_is_none(self):
        columns = self._columns_for([self._record("age", None)])
        assert columns[0]["comment"] is None


class TestTrinoTableCommentsFilter:
    """The schema-wide table_comments scan is restricted to the tables the source kept"""

    @staticmethod
    def _dialect(comment_table_names):
        dialect = Mock()
        dialect._get_default_catalog_name.return_value = "test_catalog"
        dialect._get_default_schema_name.return_value = None
        dialect.processed_schema = set()
        dialect.comment_table_names = comment_table_names
        dialect.queries = []

        def record_query(connection, query):
            dialect.queries.append(query)
            dialect.all_table_comments = {("orders", "test_schema"): "Orders"}
            dialect.current_db = connection.engine.url.database

        dialect.get_all_table_comments.side_effect = record_query
        return dialect

    def test_query_restricted_to_recorded_tables(self):
        dialect = self._dialect({"test_schema": {"orders", "o'neil"}})

        comment = get_table_comment(dialect, Mock(), "orders", "test_schema")

        assert comment == {"text": "Orders"}
        assert len(dialect.queries) == 1
        assert "\"schema_name\" = 'test_schema'" in dialect.queries[0]
        assert "and \"table_name\" IN ('o''neil', 'orders')" in dialect.queries[0]

    def test_query_unrestricted_without_recorded_tables(self):
        dialect = self._dialect({})

        get_table_comment(dialect, Mock(), "orders", "test_schema")

        assert len(dialect.queries) == 1
        assert '"table_name" IN' not in dialect.queries[0]

    @staticmethod
    def _source(table_filter):
        source = TrinoSource.__new__(TrinoSource)
        source.context = Mock()
        source.context.get.return_value.database_schema = "test_schema"
        source.source_config = Mock(tableFilterPattern=table_filter)
        source.engine = Mock()
        source.engine.dialect = Mock(spec=[])
        return source

    def test_get_tables_name_and_type_records_filtered_tables(self):
        source = self._source(FilterPattern(includes=["orders", "customers_v"]))
        kept = [("orders", TableType.Iceberg), ("customers_v", TableType.View)]

        with patch.object(CommonDbSourceService, "get_tables_name_and_type", return_value=iter(kept)):
            tables = source.get_tables_name_and_type()
            first = next(tables)
            # Recorded while the schema's tables are being processed...
            assert source.engine.dialect.comment_table_names == {"test_schema": {"orders", "customers_v"}}
            rest = list(tables)

        assert [first, *rest] == kept
        # ...and dropped once the schema is done.
        assert source.engine.dialect.comment_table_names == {}

    def test_get_tables_name_and_type_cleans_up_on_early_close(self):
        source = self._source(FilterPattern(includes=["orders"]))
        kept = [("orders", TableType.Iceberg), ("customers", TableType.Iceberg)]

        with patch.object(CommonDbSourceService, "get_tables_name_and_type", return_value=iter(kept)):
            tables = source.get_tables_name_and_type()
            next(tables)
            tables.close()

        assert source.engine.dialect.comment_table_names == {}

    def test_get_tables_name_and_type_records_nothing_without_filter(self):
        source = self._source(None)
        kept = [("orders", TableType.Iceberg)]

        with patch.object(CommonDbSourceService, "get_tables_name_and_type", return_value=iter(kept)):
            tables = source.get_tables_name_and_type()
            assert next(tables) == kept[0]
            assert not hasattr(source.engine.dialect, "comment_table_names")
            assert list(tables) == []

    def test_get_tables_name_and_type_records_nothing_above_cap(self):
        source = self._source(FilterPattern(excludes=["^tmp_"]))
        kept = [(f"t{i}", TableType.Iceberg) for i in range(MAX_COMMENT_TABLE_NAMES + 1)]

        with patch.object(CommonDbSourceService, "get_tables_name_and_type", return_value=iter(kept)):
            tables = source.get_tables_name_and_type()
            next(tables)
            assert source.engine.dialect.comment_table_names == {}
            assert len(list(tables)) == MAX_COMMENT_TABLE_NAMES

    def test_get_tables_name_and_type_reads_at_most_one_past_the_cap_ahead(self):
        source = self._source(FilterPattern(excludes=["^tmp_"]))
        total = MAX_COMMENT_TABLE_NAMES * 3
        pulled = []

        def listing():
            for i in range(total):
                pulled.append(i)
                yield (f"t{i}", TableType.Iceberg)

        with patch.object(CommonDbSourceService, "get_tables_name_and_type", return_value=listing()):
            tables = source.get_tables_name_and_type()
            next(tables)
            # Only the read-ahead window is buffered before the first table is processed...
            assert len(pulled) == MAX_COMMENT_TABLE_NAMES + 1
            # ...and the rest is streamed, nothing dropped.
            assert len(list(tables)) == total - 1
        assert len(pulled) == total


if __name__ == "__main__":
    unittest.main()
