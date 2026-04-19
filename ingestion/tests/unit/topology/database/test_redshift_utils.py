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

"""Test Redshift Utils"""

import unittest
from unittest.mock import MagicMock, Mock

from metadata.ingestion.source.database.redshift.utils import (
    _get_all_relation_info,
    _get_args_and_kwargs,
    _update_coltype,
    get_view_definition,
    ischema_names,
)


class TestGetViewDefinition(unittest.TestCase):
    """Test get_view_definition formatting and prefix handling"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_connection = Mock()
        self.mock_self = Mock()
        self.mock_view = Mock()
        self.mock_view.schema = "test_schema"
        self.mock_view.relname = "test_view"
        self.mock_self._get_redshift_relation = MagicMock(return_value=self.mock_view)

    def test_view_definition_with_create_view(self):
        """Test that view definition with CREATE VIEW is not modified"""
        self.mock_view.view_definition = (
            "CREATE VIEW test_schema.test_view AS SELECT * FROM table1"
        )

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result, "CREATE VIEW test_schema.test_view AS SELECT * FROM table1"
        )

    def test_view_definition_without_create_view(self):
        """Test that view definition without CREATE VIEW gets it prepended"""
        self.mock_view.view_definition = "SELECT * FROM table1"

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result, "CREATE VIEW test_schema.test_view AS SELECT * FROM table1"
        )

    def test_view_definition_with_sql_comment_before_create(self):
        """Test view definition with SQL comment before CREATE VIEW (expected scenario)"""
        self.mock_view.view_definition = "/* some comment */\n\tCREATE VIEW test_schema.test_view AS SELECT * FROM table1"

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result,
            "/* some comment */\n\tCREATE VIEW test_schema.test_view AS SELECT * FROM table1",
        )

    def test_view_definition_removes_schema_binding(self):
        """Test that WITH NO SCHEMA BINDING is removed"""
        self.mock_view.view_definition = "CREATE VIEW test_schema.test_view AS SELECT * FROM table1 WITH NO SCHEMA BINDING"

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result, "CREATE VIEW test_schema.test_view AS SELECT * FROM table1 "
        )

    def test_materialized_view_definition_with_create(self):
        """Test that view definition with CREATE MATERIALIZED VIEW is not modified"""
        self.mock_view.view_definition = (
            "CREATE MATERIALIZED VIEW test_schema.test_view AS SELECT * FROM table1"
        )

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result,
            "CREATE MATERIALIZED VIEW test_schema.test_view AS SELECT * FROM table1",
        )

    def test_materialized_view_definition_without_create(self):
        """Test that materialized view definition without CREATE gets CREATE VIEW prepended"""
        self.mock_view.view_definition = (
            "SELECT * FROM table1 JOIN table2 ON table1.id = table2.id"
        )

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result,
            "CREATE VIEW test_schema.test_view AS SELECT * FROM table1 JOIN table2 ON table1.id = table2.id",
        )

    def test_materialized_view_definition_removes_schema_binding(self):
        """Test that WITH NO SCHEMA BINDING is removed from materialized view"""
        self.mock_view.view_definition = "CREATE MATERIALIZED VIEW test_schema.test_view AS SELECT * FROM table1 WITH NO SCHEMA BINDING"

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result,
            "CREATE MATERIALIZED VIEW test_schema.test_view AS SELECT * FROM table1 ",
        )

    def test_materialized_view_with_comment_before_create(self):
        """Test materialized view definition with SQL comment before CREATE MATERIALIZED VIEW"""
        self.mock_view.view_definition = "/* some comment */\n\tCREATE MATERIALIZED VIEW test_schema.test_view AS SELECT * FROM table1"

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result,
            "/* some comment */\n\tCREATE MATERIALIZED VIEW test_schema.test_view AS SELECT * FROM table1",
        )

    def test_view_definition_with_create_or_replace_view(self):
        """Test that view definition with CREATE OR REPLACE VIEW is not modified"""
        self.mock_view.view_definition = (
            "CREATE OR REPLACE VIEW test_schema.test_view AS SELECT * FROM table1"
        )

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result,
            "CREATE OR REPLACE VIEW test_schema.test_view AS SELECT * FROM table1",
        )

    def test_materialized_view_definition_with_create_or_replace(self):
        """Test that definition with CREATE OR REPLACE MATERIALIZED VIEW is not modified"""
        self.mock_view.view_definition = "CREATE OR REPLACE MATERIALIZED VIEW test_schema.test_view AS SELECT * FROM table1"

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result,
            "CREATE OR REPLACE MATERIALIZED VIEW test_schema.test_view AS SELECT * FROM table1",
        )

    def test_external_view_definition_with_create(self):
        """Test that view definition with CREATE EXTERNAL VIEW is not modified"""
        self.mock_view.view_definition = (
            "CREATE EXTERNAL VIEW test_schema.test_view AS SELECT * FROM table1"
        )

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result,
            "CREATE EXTERNAL VIEW test_schema.test_view AS SELECT * FROM table1",
        )

    def test_external_view_definition_removes_schema_binding(self):
        """Test that WITH NO SCHEMA BINDING is removed from external view"""
        self.mock_view.view_definition = "CREATE EXTERNAL VIEW test_schema.test_view AS SELECT * FROM table1 WITH NO SCHEMA BINDING"

        result = get_view_definition(
            self.mock_self,
            self.mock_connection,
            "test_view",
            schema="test_schema",
        )

        self.assertEqual(
            result,
            "CREATE EXTERNAL VIEW test_schema.test_view AS SELECT * FROM table1 ",
        )


class TestGetAllRelationInfoCache(unittest.TestCase):
    """Test _get_all_relation_info single-schema cache"""

    @staticmethod
    def _make_relation(relname, schema):
        rel = Mock()
        rel.relname = relname
        rel.schema = schema
        return rel

    @staticmethod
    def _make_result(relations):
        result = MagicMock()
        result.__iter__ = Mock(return_value=iter(relations))
        return result

    def setUp(self):
        self.mock_self = Mock(spec=[])
        self.mock_connection = Mock()

    def test_cache_returns_all_relations_regardless_of_table_name(self):
        """Passing table_name must not filter the cached results."""
        relations = [
            self._make_relation("view_a", "my_schema"),
            self._make_relation("view_b", "my_schema"),
            self._make_relation("table_c", "my_schema"),
        ]
        self.mock_connection.execute.return_value = self._make_result(relations)

        result = _get_all_relation_info(
            self.mock_self,
            self.mock_connection,
            schema="my_schema",
            table_name="view_a",
        )

        self.assertEqual(len(result), 3)
        self.assertEqual({k.name for k in result}, {"view_a", "view_b", "table_c"})

        # Second lookup for a different table must return the same cached dict
        result2 = _get_all_relation_info(
            self.mock_self,
            self.mock_connection,
            schema="my_schema",
            table_name="view_b",
        )

        self.assertIs(result, result2)
        self.mock_connection.execute.assert_called_once()

    def test_cache_invalidates_on_schema_change(self):
        """Moving to a new schema must replace the cached data."""
        self.mock_connection.execute.side_effect = [
            self._make_result([self._make_relation("t1", "schema_1")]),
            self._make_result([self._make_relation("t2", "schema_2")]),
        ]

        r1 = _get_all_relation_info(
            self.mock_self, self.mock_connection, schema="schema_1"
        )
        self.assertEqual({k.name for k in r1}, {"t1"})

        r2 = _get_all_relation_info(
            self.mock_self, self.mock_connection, schema="schema_2"
        )
        self.assertEqual({k.name for k in r2}, {"t2"})

        self.assertEqual(self.mock_connection.execute.call_count, 2)


class TestRedshiftColumnTypeParsing(unittest.TestCase):
    """Test Redshift column type argument parsing."""

    def test_timestamp_without_time_zone_precision_uses_keyword_argument(self):
        """Timestamp precision must not be passed as positional timezone."""
        args, kwargs = _get_args_and_kwargs(
            "0", "timestamp without time zone", "timestamp(0) without time zone"
        )

        self.assertEqual(args, ())
        self.assertEqual(kwargs, {"precision": 0, "timezone": False})

        coltype = _update_coltype(
            ischema_names["timestamp without time zone"],
            args,
            kwargs,
            "timestamp without time zone",
            "created_at",
            False,
        )

        self.assertEqual(coltype.precision, 0)
        self.assertFalse(coltype.timezone)

    def test_timestamp_with_time_zone_precision_uses_keyword_argument(self):
        """Timestamp with time zone keeps precision and timezone keywords."""
        args, kwargs = _get_args_and_kwargs(
            "0", "timestamp with time zone", "timestamp(0) with time zone"
        )

        self.assertEqual(args, ())
        self.assertEqual(kwargs, {"precision": 0, "timezone": True})

        coltype = _update_coltype(
            ischema_names["timestamp with time zone"],
            args,
            kwargs,
            "timestamp with time zone",
            "created_at",
            False,
        )

        self.assertEqual(coltype.precision, 0)
        self.assertTrue(coltype.timezone)

    def test_time_without_time_zone_precision_uses_keyword_argument(self):
        """Time precision must not be passed as positional timezone."""
        args, kwargs = _get_args_and_kwargs(
            "0", "time without time zone", "time(0) without time zone"
        )

        self.assertEqual(args, ())
        self.assertEqual(kwargs, {"precision": 0, "timezone": False})

        coltype = _update_coltype(
            ischema_names["time without time zone"],
            args,
            kwargs,
            "time without time zone",
            "started_at",
            False,
        )

        self.assertEqual(coltype.precision, 0)
        self.assertFalse(coltype.timezone)

    def test_numeric_and_character_varying_positional_arguments_are_unchanged(self):
        """Non-time types keep their established positional parsing."""
        numeric_args, numeric_kwargs = _get_args_and_kwargs(
            "10,2", "numeric", "numeric(10,2)"
        )
        varchar_args, varchar_kwargs = _get_args_and_kwargs(
            "255", "character varying", "character varying(255)"
        )

        self.assertEqual(numeric_args, (10, 2))
        self.assertEqual(numeric_kwargs, {})
        self.assertEqual(varchar_args, (255,))
        self.assertEqual(varchar_kwargs, {})


if __name__ == "__main__":
    unittest.main()
