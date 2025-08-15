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
Comprehensive tests for FQN building with special characters in table and column names.
Tests happy paths, edge cases, error scenarios, and boundaries.
"""

import unittest
from unittest.mock import Mock, patch

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.ingestion.models.custom_basemodel_validation import (
    RESERVED_ARROW_KEYWORD,
    RESERVED_COLON_KEYWORD,
    RESERVED_QUOTE_KEYWORD,
)
from metadata.utils import fqn
from metadata.utils.fqn import FQNBuildingException


class TestFQNSpecialCharacters(unittest.TestCase):
    """Test FQN building with special characters"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_metadata = Mock()

    def tearDown(self):
        """Clean up after tests"""
        # Reset any mocks
        self.mock_metadata.reset_mock()

    # ========== HAPPY PATH TESTS ==========

    def test_table_name_with_quotes(self):
        """Test table name containing quotes"""
        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Table,
            service_name="mysql",
            database_name="test_db",
            schema_name="public",
            table_name='users "2024"',
            skip_es_search=True,
        )

        expected = f"mysql.test_db.public.users {RESERVED_QUOTE_KEYWORD}2024{RESERVED_QUOTE_KEYWORD}"
        self.assertEqual(result, expected)

    def test_table_name_with_colons(self):
        """Test table name containing double colons"""
        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Table,
            service_name="postgres",
            database_name="analytics",
            schema_name="reporting",
            table_name="report::daily_summary",
            skip_es_search=True,
        )

        expected = (
            f"postgres.analytics.reporting.report{RESERVED_COLON_KEYWORD}daily_summary"
        )
        self.assertEqual(result, expected)

    def test_table_name_with_arrows(self):
        """Test table name containing arrow characters"""
        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Table,
            service_name="snowflake",
            database_name="warehouse",
            schema_name="staging",
            table_name="stage>production_data",
            skip_es_search=True,
        )

        expected = (
            f"snowflake.warehouse.staging.stage{RESERVED_ARROW_KEYWORD}production_data"
        )
        self.assertEqual(result, expected)

    def test_column_name_with_quotes(self):
        """Test column name containing quotes"""
        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Column,
            service_name="mysql",
            database_name="test_db",
            schema_name="public",
            table_name="users",
            column_name='data "value"',
        )

        expected = f"mysql.test_db.public.users.data {RESERVED_QUOTE_KEYWORD}value{RESERVED_QUOTE_KEYWORD}"
        self.assertEqual(result, expected)

    def test_column_name_with_multiple_special_chars(self):
        """Test column name with combination of special characters"""
        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Column,
            service_name="postgres",
            database_name="analytics",
            schema_name="public",
            table_name="metrics",
            column_name='metric::type>"category"',
        )

        expected = (
            f"postgres.analytics.public.metrics.metric{RESERVED_COLON_KEYWORD}"
            f"type{RESERVED_ARROW_KEYWORD}{RESERVED_QUOTE_KEYWORD}category{RESERVED_QUOTE_KEYWORD}"
        )
        self.assertEqual(result, expected)

    def test_both_table_and_column_with_special_chars(self):
        """Test both table and column names with special characters"""
        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Column,
            service_name="mysql",
            database_name="test",
            schema_name="schema",
            table_name='table "2024"',
            column_name="column::data>info",
        )

        table_transformed = (
            f"table {RESERVED_QUOTE_KEYWORD}2024{RESERVED_QUOTE_KEYWORD}"
        )
        column_transformed = (
            f"column{RESERVED_COLON_KEYWORD}data{RESERVED_ARROW_KEYWORD}info"
        )
        expected = f"mysql.test.schema.{table_transformed}.{column_transformed}"
        self.assertEqual(result, expected)

    # ========== EDGE CASES ==========

    def test_empty_special_chars_only(self):
        """Test names that are only special characters"""
        # Just quotes
        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Table,
            service_name="mysql",
            database_name="test",
            schema_name="public",
            table_name='""',
            skip_es_search=True,
        )
        expected = f"mysql.test.public.{RESERVED_QUOTE_KEYWORD}{RESERVED_QUOTE_KEYWORD}"
        self.assertEqual(result, expected)

        # Just colons
        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Column,
            service_name="mysql",
            database_name="test",
            schema_name="public",
            table_name="users",
            column_name="::",
        )
        expected = f"mysql.test.public.users.{RESERVED_COLON_KEYWORD}"
        self.assertEqual(result, expected)

    def test_consecutive_special_chars(self):
        """Test consecutive special characters"""
        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Table,
            service_name="postgres",
            database_name="db",
            schema_name="schema",
            table_name='data::::"">>>>>',
            skip_es_search=True,
        )

        # Each special char should be replaced
        transformed = (
            f"data{RESERVED_COLON_KEYWORD}{RESERVED_COLON_KEYWORD}{RESERVED_QUOTE_KEYWORD}"
            f"{RESERVED_QUOTE_KEYWORD}{RESERVED_ARROW_KEYWORD}"
            f"{RESERVED_ARROW_KEYWORD}{RESERVED_ARROW_KEYWORD}"
            f"{RESERVED_ARROW_KEYWORD}{RESERVED_ARROW_KEYWORD}"
        )
        expected = f"postgres.db.schema.{transformed}"
        self.assertEqual(result, expected)

    def test_special_chars_at_boundaries(self):
        """Test special characters at start and end of names"""
        # Special char at start
        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Table,
            service_name="mysql",
            database_name="db",
            schema_name="schema",
            table_name='"table_name',
            skip_es_search=True,
        )
        expected = f"mysql.db.schema.{RESERVED_QUOTE_KEYWORD}table_name"
        self.assertEqual(result, expected)

        # Special char at end
        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Column,
            service_name="mysql",
            database_name="db",
            schema_name="schema",
            table_name="table",
            column_name="column_name::",
        )
        expected = f"mysql.db.schema.table.column_name{RESERVED_COLON_KEYWORD}"
        self.assertEqual(result, expected)

    def test_unicode_with_special_chars(self):
        """Test Unicode characters mixed with special characters"""
        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Table,
            service_name="mysql",
            database_name="test",
            schema_name="public",
            table_name='測試::table>"数据"',
            skip_es_search=True,
        )

        transformed = f"測試{RESERVED_COLON_KEYWORD}table{RESERVED_ARROW_KEYWORD}{RESERVED_QUOTE_KEYWORD}数据{RESERVED_QUOTE_KEYWORD}"
        expected = f"mysql.test.public.{transformed}"
        self.assertEqual(result, expected)

    def test_emoji_with_special_chars(self):
        """Test emojis mixed with special characters"""
        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Column,
            service_name="postgres",
            database_name="fun",
            schema_name="emoji",
            table_name="data",
            column_name='🚀::rocket>"launch"',
        )

        transformed = f"🚀{RESERVED_COLON_KEYWORD}rocket{RESERVED_ARROW_KEYWORD}{RESERVED_QUOTE_KEYWORD}launch{RESERVED_QUOTE_KEYWORD}"
        expected = f"postgres.fun.emoji.data.{transformed}"
        self.assertEqual(result, expected)

    # ========== NULL/NONE HANDLING ==========

    def test_none_table_name(self):
        """Test with None table name - should not transform"""
        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Database,
            service_name="mysql",
            database_name="test_db",
        )

        # Should work without transformation
        expected = "mysql.test_db"
        self.assertEqual(result, expected)

    def test_none_column_name(self):
        """Test with None column name - should handle gracefully"""
        with self.assertRaises(FQNBuildingException):
            fqn.build(
                metadata=self.mock_metadata,
                entity_type=Table,
                service_name="mysql",
                database_name="db",
                schema_name="schema",
                table_name="table_name",
                column_name=None,
                skip_es_search=True,
            )

    def test_empty_string_names(self):
        """Test with empty string names"""
        # Empty table name should still be processed
        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Table,
            service_name="mysql",
            database_name="db",
            schema_name="schema",
            table_name="",
            skip_es_search=True,
        )

        # Empty string is valid
        expected = "mysql.db.schema."
        self.assertEqual(result, expected)

    # ========== OTHER ENTITY TYPES (No Transformation) ==========

    def test_database_name_with_quotes_should_raise_error(self):
        """Test that Database entities don't get transformed"""
        with self.assertRaises(FQNBuildingException):
            fqn.build(
                metadata=self.mock_metadata,
                entity_type=Database,
                service_name="mysql",
                database_name='db "name"',
            )

    def test_schema_name_with_quotes_should_raise_error(self):
        """Test that DatabaseSchema entities don't get transformed"""
        with self.assertRaises(FQNBuildingException):
            fqn.build(
                metadata=self.mock_metadata,
                entity_type=DatabaseSchema,
                service_name="postgres",
                database_name="db",
                schema_name='schema::"name"',
                skip_es_search=True,
            )

    def test_stored_procedure_name_with_quotes_should_not_transform(self):
        """Test that StoredProcedure entities don't get transformed"""
        with self.assertRaises(FQNBuildingException):
            fqn.build(
                metadata=self.mock_metadata,
                entity_type=StoredProcedure,
                service_name="mysql",
                database_name="db",
                schema_name="schema",
                procedure_name='proc>"name"',
            )

    # ========== INTEGRATION WITH EXISTING BEHAVIOR ==========

    def test_names_without_special_chars_unchanged(self):
        """Test that names without special characters remain unchanged"""
        # Table without special chars
        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Table,
            service_name="mysql",
            database_name="test_db",
            schema_name="public",
            table_name="normal_table_name",
            skip_es_search=True,
        )
        expected = "mysql.test_db.public.normal_table_name"
        self.assertEqual(result, expected)

        # Column without special chars
        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Column,
            service_name="postgres",
            database_name="db",
            schema_name="schema",
            table_name="table",
            column_name="normal_column_name",
        )
        expected = "postgres.db.schema.table.normal_column_name"
        self.assertEqual(result, expected)

    def test_dots_in_names_still_quoted(self):
        """Test that dots in names still trigger quoting"""
        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Table,
            service_name="mysql",
            database_name="db",
            schema_name="schema",
            table_name="table.with.dots",
            skip_es_search=True,
        )

        # Dots should still trigger quoting in quote_name
        self.assertIn('"table.with.dots"', result)

    # ========== ERROR SCENARIOS ==========

    def test_invalid_entity_type_still_fails(self):
        """Test that invalid entity types still raise exceptions"""

        class InvalidEntity:
            pass

        with self.assertRaises(FQNBuildingException) as context:
            fqn.build(
                metadata=self.mock_metadata,
                entity_type=InvalidEntity,
                service_name="mysql",
            )

        self.assertIn("Invalid Entity Type", str(context.exception))

    def test_transformation_with_es_search(self):
        """Test transformation works with ES search enabled"""
        # Mock ES search to return None (entity not found)
        self.mock_metadata.es_search_from_fqn.return_value = []

        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Table,
            service_name="mysql",
            database_name="db",
            schema_name="schema",
            table_name='table "name"',
            skip_es_search=False,
        )

        # Even with ES search, transformation should happen
        expected = f"mysql.db.schema.table {RESERVED_QUOTE_KEYWORD}name{RESERVED_QUOTE_KEYWORD}"
        self.assertEqual(result, expected)

    # ========== PERFORMANCE AND SCALE ==========

    def test_very_long_names_with_special_chars(self):
        """Test very long names with special characters"""
        long_name = "a" * 100 + "::" + "b" * 100 + '>"' + "c" * 100 + '"'

        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Table,
            service_name="mysql",
            database_name="db",
            schema_name="schema",
            table_name=long_name,
            skip_es_search=True,
        )

        # Should handle long names
        self.assertIn(RESERVED_COLON_KEYWORD, result)
        self.assertIn(RESERVED_ARROW_KEYWORD, result)
        self.assertIn(RESERVED_QUOTE_KEYWORD, result)
        self.assertIn("a" * 100, result)
        self.assertIn("b" * 100, result)
        self.assertIn("c" * 100, result)

    def test_reserved_keywords_in_names(self):
        """Test that reserved keywords themselves are handled"""
        # What if someone has __reserved__colon__ in their table name?
        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Table,
            service_name="mysql",
            database_name="db",
            schema_name="schema",
            table_name=f"table{RESERVED_COLON_KEYWORD}weird",
            skip_es_search=True,
        )

        # Should not double-transform
        expected = f"mysql.db.schema.table{RESERVED_COLON_KEYWORD}weird"
        self.assertEqual(result, expected)

    # ========== IMPORT ERROR HANDLING ==========

    @patch("metadata.utils.fqn.build")
    def test_import_error_handling(self, mock_build):
        """Test handling when custom_basemodel_validation import fails"""

        def side_effect(*args, **kwargs):
            # Simulate import error
            if kwargs.get("table_name") or kwargs.get("column_name"):
                raise ImportError("Cannot import custom_basemodel_validation")
            return "mysql.db.schema.table"

        mock_build.side_effect = side_effect

        # Should raise the import error
        with self.assertRaises(ImportError):
            mock_build(
                metadata=self.mock_metadata,
                entity_type=Table,
                service_name="mysql",
                database_name="db",
                schema_name="schema",
                table_name='table "name"',
            )


class TestFQNSpecialCharsRealWorldScenarios(unittest.TestCase):
    """Test real-world scenarios from actual database systems"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_metadata = Mock()
        self.mock_metadata.es_search_from_fqn.return_value = []

    def test_snowflake_quoted_identifiers(self):
        """Test Snowflake-style quoted identifiers"""
        # Snowflake uses quotes for case-sensitive identifiers
        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Table,
            service_name="snowflake",
            database_name="ANALYTICS",
            schema_name="PUBLIC",
            table_name='"MixedCase_Table"',
            skip_es_search=True,
        )

        expected = f"snowflake.ANALYTICS.PUBLIC.{RESERVED_QUOTE_KEYWORD}MixedCase_Table{RESERVED_QUOTE_KEYWORD}"
        self.assertEqual(result, expected)

    def test_postgres_special_schemas(self):
        """Test PostgreSQL special schema names"""
        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Column,
            service_name="postgres",
            database_name="mydb",
            schema_name="pg_catalog",
            table_name="pg_type",
            column_name="typname::text",
        )

        expected = (
            f"postgres.mydb.pg_catalog.pg_type.typname{RESERVED_COLON_KEYWORD}text"
        )
        self.assertEqual(result, expected)

    def test_bigquery_dataset_table_notation(self):
        """Test BigQuery dataset.table notation"""
        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Table,
            service_name="bigquery",
            database_name="my-project",
            schema_name="dataset",
            table_name='table_2024_01_01$"partition"',
            skip_es_search=True,
        )

        # Dollar signs are not transformed, only quotes
        expected = f"bigquery.my-project.dataset.table_2024_01_01${RESERVED_QUOTE_KEYWORD}partition{RESERVED_QUOTE_KEYWORD}"
        self.assertEqual(result, expected)

    def test_mysql_backtick_conversion(self):
        """Test MySQL backtick identifiers (already handled by parser)"""
        # Assuming backticks are converted to quotes before reaching FQN
        result = fqn.build(
            metadata=self.mock_metadata,
            entity_type=Column,
            service_name="mysql",
            database_name="test",
            schema_name="public",
            table_name="orders",
            column_name='"order-date"',  # Backticks converted to quotes
        )

        expected = f"mysql.test.public.orders.{RESERVED_QUOTE_KEYWORD}order-date{RESERVED_QUOTE_KEYWORD}"
        self.assertEqual(result, expected)


if __name__ == "__main__":
    unittest.main()
