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
Unit tests for parser selection factory
"""
import unittest
import warnings

from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.parser_selection import (
    LineageParserType,
    create_lineage_parser,
)
from metadata.ingestion.lineage.sqlglot_parser import SQLGlotLineageRunner


class TestParserSelection(unittest.TestCase):
    """Test cases for parser factory selection"""

    TEST_QUERY = "SELECT name, email FROM users WHERE id = 123"

    def test_default_parser_is_sqlglot(self):
        """Test that default parser is SQLGlot when parser_type is None"""
        parser = create_lineage_parser(
            query=self.TEST_QUERY, dialect=Dialect.POSTGRES, parser_type=None
        )

        self.assertIsInstance(
            parser,
            SQLGlotLineageRunner,
            "Default parser should be SQLGlotLineageRunner",
        )
        self.assertTrue(
            parser.query_parsing_success, "Parser should successfully parse query"
        )

    def test_explicit_sqlglot_parser(self):
        """Test explicit selection of SQLGlot parser"""
        parser = create_lineage_parser(
            query=self.TEST_QUERY,
            dialect=Dialect.POSTGRES,
            parser_type=LineageParserType.SQLGLOT,
        )

        self.assertIsInstance(
            parser,
            SQLGlotLineageRunner,
            "Should return SQLGlotLineageRunner when parser_type=SQLGLOT",
        )

    def test_string_parser_type_sqlglot(self):
        """Test parser selection with string parser type 'sqlglot'"""
        parser = create_lineage_parser(
            query=self.TEST_QUERY, dialect=Dialect.POSTGRES, parser_type="sqlglot"
        )

        self.assertIsInstance(
            parser,
            SQLGlotLineageRunner,
            "Should return SQLGlotLineageRunner when parser_type='sqlglot'",
        )

    def test_string_parser_type_case_insensitive(self):
        """Test that string parser type is case-insensitive"""
        for parser_type_str in ["SQLGLOT", "SQLGlot", "sqlGLOT"]:
            parser = create_lineage_parser(
                query=self.TEST_QUERY,
                dialect=Dialect.POSTGRES,
                parser_type=parser_type_str,
            )

            self.assertIsInstance(
                parser,
                SQLGlotLineageRunner,
                f"Should return SQLGlotLineageRunner for case variant '{parser_type_str}'",
            )

    def test_auto_mode_selects_sqlglot(self):
        """Test that AUTO mode selects SQLGlot for valid queries"""
        parser = create_lineage_parser(
            query=self.TEST_QUERY,
            dialect=Dialect.POSTGRES,
            parser_type=LineageParserType.AUTO,
        )

        self.assertIsInstance(
            parser,
            SQLGlotLineageRunner,
            "AUTO mode should select SQLGlotLineageRunner for valid queries",
        )

    def test_sqlfluff_parser_deprecation_warning(self):
        """Test that sqlfluff parser raises deprecation warning"""
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")

            parser = create_lineage_parser(
                query=self.TEST_QUERY,
                dialect=Dialect.POSTGRES,
                parser_type=LineageParserType.SQLFLUFF,
            )

            # Check deprecation warning was raised
            self.assertEqual(len(w), 1, "Should raise exactly one warning")
            self.assertTrue(
                issubclass(w[0].category, DeprecationWarning),
                "Should raise DeprecationWarning",
            )
            self.assertIn(
                "deprecated",
                str(w[0].message).lower(),
                "Warning should mention deprecated",
            )
            self.assertIn(
                "42%", str(w[0].message), "Warning should mention 42% success rate"
            )
            self.assertIn(
                "100%", str(w[0].message), "Warning should mention 100% success rate"
            )

            # Verify it returns LineageParser (legacy)
            self.assertIsInstance(
                parser,
                LineageParser,
                "SQLFLUFF parser type should return LineageParser",
            )

    def test_sqlparse_parser_returns_lineage_parser(self):
        """Test that sqlparse parser type returns LineageParser with ANSI dialect"""
        parser = create_lineage_parser(
            query=self.TEST_QUERY,
            dialect=Dialect.POSTGRES,  # Should be overridden to ANSI
            parser_type=LineageParserType.SQLPARSE,
        )

        self.assertIsInstance(
            parser,
            LineageParser,
            "SQLPARSE parser type should return LineageParser",
        )
        self.assertEqual(
            parser.dialect,
            Dialect.ANSI,
            "SQLPARSE should use ANSI dialect regardless of input",
        )

    def test_unknown_parser_type_string_defaults_to_sqlglot(self):
        """Test that unknown parser type string defaults to SQLGlot with warning"""
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")

            parser = create_lineage_parser(
                query=self.TEST_QUERY,
                dialect=Dialect.POSTGRES,
                parser_type="unknown_parser",
            )

            # Should log a warning but still return SQLGlot
            self.assertIsInstance(
                parser,
                SQLGlotLineageRunner,
                "Unknown parser type should default to SQLGlotLineageRunner",
            )

    def test_parser_factory_interface_compatibility(self):
        """Test that all parsers from factory have required interface"""
        parser_types = [
            LineageParserType.SQLGLOT,
            LineageParserType.SQLFLUFF,
            LineageParserType.SQLPARSE,
        ]

        for parser_type in parser_types:
            with self.subTest(parser_type=parser_type):
                # Suppress deprecation warnings for this test
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore", DeprecationWarning)

                    parser = create_lineage_parser(
                        query=self.TEST_QUERY,
                        dialect=Dialect.POSTGRES,
                        parser_type=parser_type,
                    )

                    # Check all required properties exist
                    self.assertTrue(
                        hasattr(parser, "masked_query"), "Should have masked_query"
                    )
                    self.assertTrue(
                        hasattr(parser, "query_parsing_success"),
                        "Should have query_parsing_success",
                    )
                    self.assertTrue(
                        hasattr(parser, "query_parsing_failure_reason"),
                        "Should have query_parsing_failure_reason",
                    )
                    self.assertTrue(
                        hasattr(parser, "source_tables"), "Should have source_tables"
                    )
                    self.assertTrue(
                        hasattr(parser, "target_tables"), "Should have target_tables"
                    )
                    self.assertTrue(
                        hasattr(parser, "intermediate_tables"),
                        "Should have intermediate_tables",
                    )
                    self.assertTrue(
                        hasattr(parser, "column_lineage"), "Should have column_lineage"
                    )

    def test_dialect_enum_and_string_both_work(self):
        """Test that both Dialect enum and string dialect work"""
        # Test with Dialect enum
        parser1 = create_lineage_parser(
            query=self.TEST_QUERY,
            dialect=Dialect.POSTGRES,
            parser_type=LineageParserType.SQLGLOT,
        )

        # Test with string
        parser2 = create_lineage_parser(
            query=self.TEST_QUERY,
            dialect="postgres",
            parser_type=LineageParserType.SQLGLOT,
        )

        self.assertIsInstance(parser1, SQLGlotLineageRunner)
        self.assertIsInstance(parser2, SQLGlotLineageRunner)
        self.assertTrue(parser1.query_parsing_success)
        self.assertTrue(parser2.query_parsing_success)

    def test_parser_extracts_tables_correctly(self):
        """Test that parser factory returns parsers that extract tables"""
        parser = create_lineage_parser(
            query="SELECT t1.name FROM users t1 JOIN accounts t2 ON t1.id = t2.user_id",
            dialect=Dialect.POSTGRES,
        )

        source_table_names = {str(table) for table in parser.source_tables}
        self.assertIn("users", source_table_names, "Should extract 'users' table")
        self.assertIn("accounts", source_table_names, "Should extract 'accounts' table")

    def test_parser_handles_invalid_query(self):
        """Test that parser factory handles invalid queries gracefully"""
        parser = create_lineage_parser(
            query="INVALID SQL QUERY THAT MAKES NO SENSE",
            dialect=Dialect.POSTGRES,
            parser_type=LineageParserType.SQLGLOT,
        )

        self.assertFalse(
            parser.query_parsing_success, "Should mark query as failed to parse"
        )
        self.assertIsNotNone(
            parser.query_parsing_failure_reason, "Should provide failure reason"
        )

    def test_timeout_parameter_passed_through(self):
        """Test that timeout_seconds parameter is passed to parsers"""
        # This test verifies the parameter is accepted without error
        # Actual timeout behavior would require integration testing
        parser = create_lineage_parser(
            query=self.TEST_QUERY,
            dialect=Dialect.POSTGRES,
            parser_type=LineageParserType.SQLGLOT,
            timeout_seconds=30,
        )

        self.assertIsInstance(parser, SQLGlotLineageRunner)

    def test_schema_parameter_for_sqlglot(self):
        """Test that schema parameter is passed to SQLGlot parser"""
        schema = {"users": {"id": "INT", "name": "VARCHAR", "email": "VARCHAR"}}

        parser = create_lineage_parser(
            query=self.TEST_QUERY,
            dialect=Dialect.POSTGRES,
            parser_type=LineageParserType.SQLGLOT,
            schema=schema,
        )

        self.assertIsInstance(parser, SQLGlotLineageRunner)
        self.assertEqual(parser.schema, schema, "Schema should be passed to parser")


if __name__ == "__main__":
    unittest.main()
