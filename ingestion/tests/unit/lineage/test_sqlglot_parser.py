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
Unit tests for SQLGlot-based lineage parser
"""
import unittest

from metadata.ingestion.lineage.sqlglot_parser import SQLGlotLineageRunner


class TestSQLGlotParser(unittest.TestCase):
    """Test cases for SQLGlot lineage parser"""

    def test_query_masking_string_literals(self):
        """Test masking of string literals"""
        test_cases = [
            {
                "query": "SELECT * FROM user WHERE name='Alice' AND email='alice@example.com'",
                "dialect": "postgres",
                "expected": "SELECT * FROM user WHERE name = ? AND email = ?",
            },
            {
                "query": "INSERT INTO user VALUES ('John', 'john@example.com')",
                "dialect": "postgres",
                "expected": "INSERT INTO user VALUES (?, ?)",
            },
            {
                "query": "SELECT * FROM users WHERE address = '5th street' AND name = 'john'",
                "dialect": "ansi",
                "expected": "SELECT * FROM users WHERE address = ? AND name = ?",
            },
        ]

        for test_case in test_cases:
            runner = SQLGlotLineageRunner(
                test_case["query"], dialect=test_case["dialect"]
            )
            self.assertEqual(
                runner.masked_query,
                test_case["expected"],
                f"Failed for query: {test_case['query']}",
            )

    def test_query_masking_numeric_literals(self):
        """Test masking of numeric literals"""
        test_cases = [
            {
                "query": "SELECT * FROM user WHERE id=1234 AND age=25",
                "dialect": "mysql",
                "expected": "SELECT * FROM user WHERE id = ? AND age = ?",
            },
            {
                "query": "SELECT * FROM orders WHERE price > 99.99 AND quantity < 100",
                "dialect": "postgres",
                "expected": "SELECT * FROM orders WHERE price > ? AND quantity < ?",
            },
            {
                "query": "UPDATE employees SET salary = 50000 WHERE id = 123",
                "dialect": "postgres",
                "expected": "UPDATE employees SET salary = ? WHERE id = ?",
            },
        ]

        for test_case in test_cases:
            runner = SQLGlotLineageRunner(
                test_case["query"], dialect=test_case["dialect"]
            )
            self.assertEqual(
                runner.masked_query,
                test_case["expected"],
                f"Failed for query: {test_case['query']}",
            )

    def test_query_masking_date_literals(self):
        """Test masking of date and datetime literals"""
        test_cases = [
            {
                "query": "SELECT * FROM user WHERE birthdate=DATE '2023-01-01'",
                "dialect": "mysql",
                # SQLGlot may transform DATE '2023-01-01' to CAST(? AS DATE)
                "check_literals_masked": True,
            },
            {
                "query": "SELECT * FROM orders WHERE created_at = '2024-01-15 10:30:00'",
                "dialect": "postgres",
                "expected": "SELECT * FROM orders WHERE created_at = ?",
            },
        ]

        for test_case in test_cases:
            runner = SQLGlotLineageRunner(
                test_case["query"], dialect=test_case["dialect"]
            )

            if "expected" in test_case:
                self.assertEqual(
                    runner.masked_query,
                    test_case["expected"],
                    f"Failed for query: {test_case['query']}",
                )
            elif test_case.get("check_literals_masked"):
                # Just check that literals are masked (SQLGlot may transform syntax)
                self.assertIn("?", runner.masked_query)
                self.assertNotIn("2023-01-01", runner.masked_query)

    def test_query_masking_insert_multiple_rows(self):
        """Test masking INSERT statements with multiple rows"""
        query = "INSERT INTO user VALUES ('mayur',123,'my random address 1'), ('john',456,'my random address 2')"
        expected = "INSERT INTO user VALUES (?, ?, ?), (?, ?, ?)"

        runner = SQLGlotLineageRunner(query, dialect="ansi")
        self.assertEqual(runner.masked_query, expected)

    def test_query_masking_case_statements(self):
        """Test masking CASE statements"""
        test_cases = [
            {
                "query": "SELECT CASE address WHEN '5th Street' THEN 'CEO' ELSE 'Unknown' END AS person FROM user",
                "expected": "SELECT CASE address WHEN ? THEN ? ELSE ? END AS person FROM user",
            },
            {
                "query": "SELECT CASE WHEN age > 18 THEN 'Adult' WHEN age > 13 THEN 'Teen' ELSE 'Child' END FROM users",
                "expected": "SELECT CASE WHEN age > ? THEN ? WHEN age > ? THEN ? ELSE ? END FROM users",
            },
        ]

        for test_case in test_cases:
            runner = SQLGlotLineageRunner(test_case["query"], dialect="ansi")
            self.assertEqual(
                runner.masked_query,
                test_case["expected"],
                f"Failed for query: {test_case['query']}",
            )

    def test_query_masking_cte(self):
        """Test masking queries with CTEs (Common Table Expressions)"""
        query = """
        WITH test AS (
            SELECT CASE address WHEN '5th Street' THEN 'CEO' ELSE 'Unknown' END AS person
            FROM user
            WHERE age > 18
        )
        SELECT * FROM test
        """
        expected_contains = ["?", "SELECT", "FROM", "WHERE"]

        runner = SQLGlotLineageRunner(query, dialect="ansi")
        for expected_part in expected_contains:
            self.assertIn(expected_part, runner.masked_query)

        # Should not contain original literals
        self.assertNotIn("5th Street", runner.masked_query)
        self.assertNotIn("18", runner.masked_query)
        self.assertNotIn("CEO", runner.masked_query)

    def test_query_masking_subqueries(self):
        """Test masking nested subqueries"""
        query = "SELECT * FROM (SELECT * FROM (SELECT CASE address WHEN '5th Street' THEN 'CEO' ELSE 'Unknown' END AS person FROM user))"

        runner = SQLGlotLineageRunner(query, dialect="ansi")

        # Should not contain original literals
        self.assertNotIn("5th Street", runner.masked_query)
        self.assertNotIn("CEO", runner.masked_query)
        self.assertNotIn("Unknown", runner.masked_query)

        # Should contain mask tokens
        self.assertIn("?", runner.masked_query)

    def test_query_masking_in_clause(self):
        """Test masking IN clause with multiple values"""
        query = "SELECT * FROM users WHERE status IN ('active', 'pending', 'approved')"
        expected = "SELECT * FROM users WHERE status IN (?, ?, ?)"

        runner = SQLGlotLineageRunner(query, dialect="postgres")
        self.assertEqual(runner.masked_query, expected)

    def test_query_masking_create_table_as_select(self):
        """Test masking CREATE TABLE AS SELECT statements"""
        query = "CREATE TABLE db001.table001 AS SELECT * FROM db002.table002 WHERE age > 18 AND name = 'John'"

        runner = SQLGlotLineageRunner(query, dialect="ansi")

        # Should not contain original literals
        self.assertNotIn("18", runner.masked_query)
        self.assertNotIn("John", runner.masked_query)

        # Should contain mask tokens
        self.assertIn("?", runner.masked_query)

    def test_source_tables_extraction(self):
        """Test extraction of source tables"""
        query = "SELECT t1.col1, t2.col2 FROM table1 t1 JOIN table2 t2 ON t1.id = t2.id"

        runner = SQLGlotLineageRunner(query, dialect="postgres")

        source_table_names = {str(table) for table in runner.source_tables}
        self.assertIn("table1", source_table_names)
        self.assertIn("table2", source_table_names)

    def test_target_tables_extraction_insert(self):
        """Test extraction of target tables for INSERT"""
        query = "INSERT INTO users (name, email) VALUES ('John', 'john@example.com')"

        runner = SQLGlotLineageRunner(query, dialect="postgres")

        target_table_names = {str(table) for table in runner.target_tables}
        self.assertIn("users", target_table_names)

    def test_target_tables_extraction_update(self):
        """Test extraction of target tables for UPDATE"""
        query = "UPDATE employees SET salary = 50000 WHERE id = 123"

        runner = SQLGlotLineageRunner(query, dialect="postgres")

        target_table_names = {str(table) for table in runner.target_tables}
        self.assertIn("employees", target_table_names)

    def test_column_lineage_simple_select(self):
        """Test column lineage extraction for simple SELECT"""
        query = "SELECT name, email FROM users"

        runner = SQLGlotLineageRunner(query, dialect="postgres")

        column_lineage = runner.get_column_lineage()
        self.assertIsInstance(column_lineage, list)

    def test_parsing_success_valid_query(self):
        """Test query_parsing_success for valid query"""
        query = "SELECT * FROM users WHERE id = 1"

        runner = SQLGlotLineageRunner(query, dialect="postgres")

        self.assertTrue(runner.query_parsing_success)
        self.assertIsNone(runner.query_parsing_failure_reason)

    def test_parsing_failure_invalid_query(self):
        """Test query_parsing_success for invalid query"""
        query = "SELEC * FRON users WHER"  # Intentionally malformed

        runner = SQLGlotLineageRunner(query, dialect="postgres")

        self.assertFalse(runner.query_parsing_success)
        self.assertIsNotNone(runner.query_parsing_failure_reason)
        self.assertIn("SQLGlot parsing failed", runner.query_parsing_failure_reason)

    def test_interface_compatibility(self):
        """Test that SQLGlotLineageRunner has all required properties"""
        query = "SELECT * FROM users WHERE id = 1"

        runner = SQLGlotLineageRunner(query, dialect="postgres")

        # Check all required properties exist
        self.assertTrue(hasattr(runner, "masked_query"))
        self.assertTrue(hasattr(runner, "query_parsing_success"))
        self.assertTrue(hasattr(runner, "query_parsing_failure_reason"))
        self.assertTrue(hasattr(runner, "source_tables"))
        self.assertTrue(hasattr(runner, "target_tables"))
        self.assertTrue(hasattr(runner, "intermediate_tables"))
        self.assertTrue(hasattr(runner, "column_lineage"))

    def test_masked_query_different_dialects(self):
        """Test masking works across different SQL dialects"""
        query = "SELECT * FROM users WHERE name = 'John' AND age > 25"

        dialects = ["postgres", "mysql", "snowflake", "bigquery", "oracle", "tsql"]

        for dialect in dialects:
            runner = SQLGlotLineageRunner(query, dialect=dialect)

            # Should mask literals regardless of dialect
            self.assertNotIn("John", runner.masked_query)
            self.assertNotIn("25", runner.masked_query)
            self.assertIn("?", runner.masked_query)

    def test_empty_query(self):
        """Test handling of empty query"""
        query = ""

        runner = SQLGlotLineageRunner(query, dialect="postgres")

        self.assertFalse(runner.query_parsing_success)
        self.assertEqual(len(runner.source_tables), 0)
        self.assertEqual(len(runner.target_tables), 0)

    def test_complex_join_query(self):
        """Test masking and extraction for complex JOIN query"""
        query = """
        SELECT u.name, o.order_total, p.product_name
        FROM users u
        JOIN orders o ON u.id = o.user_id
        JOIN products p ON o.product_id = p.id
        WHERE u.status = 'active' AND o.total > 100
        """

        runner = SQLGlotLineageRunner(query, dialect="postgres")

        # Check masking
        self.assertNotIn("active", runner.masked_query)
        self.assertNotIn("100", runner.masked_query)

        # Check table extraction
        source_table_names = {str(table) for table in runner.source_tables}
        self.assertIn("users", source_table_names)
        self.assertIn("orders", source_table_names)
        self.assertIn("products", source_table_names)


if __name__ == "__main__":
    unittest.main()
