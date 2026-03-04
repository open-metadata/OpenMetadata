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
Query masking tests

Tests for masking SQL queries with different parsers (SqlGlot, SqlFluff, SqlParse).
Since all parsers now use SqlParse for masking, they should produce identical output.
"""
from unittest import TestCase

import pytest

from ingestion.tests.unit.lineage.queries.helpers import assert_masked_query
from metadata.ingestion.lineage.masker import mask_query, masked_query_cache
from metadata.ingestion.lineage.models import Dialect


class TestQueryMasker(TestCase):
    """
    Test query masking functionality across different SQL parsers.

    Note: SqlParse uses SqlParse to mask query so results will be identical, but
        if sqlglot failed to parse the query then masking will not be performed
    """

    def test_query_masker_identical_output(self):
        """
        Test that all parsers produce identical masked output.

        Since all parsers use SqlParse for masking, the output should be
        identical across SqlGlot, SqlFluff, and SqlParse analyzers.
        """
        query_test_cases = [
            {
                "query": """SELECT * FROM user WHERE id=1234 AND name='Alice' AND birthdate=DATE '2023-01-01';""",
                "expected": """SELECT * FROM user WHERE id=? AND name=? AND birthdate=DATE ?;""",
                "dialect": Dialect.MYSQL.value,
            },
            {
                "query": """insert into user values ('mayur',123,'my random address 1'), ('mayur',123,'my random address 1');""",  # noqa: E501
                "expected": """insert into user values (?,?,?), (?,?,?);""",
                "dialect": Dialect.ANSI.value,
            },
            {
                "query": """SELECT * FROM user WHERE address = '5th street' and name = 'john';""",
                "expected": """SELECT * FROM user WHERE address = ? and name = ?;""",
                "dialect": Dialect.ANSI.value,
            },
            # VALUE keyword here is not standard SQL and SqlGlot throws error
            # even though SqlFluff and SqlParse handle this.
            # TODO: evaluate later if any similar case noticed, commented for now
            # {
            #     "query": """INSERT INTO user VALUE ('John', '19', '5TH Street');""",
            #     "expected": """INSERT INTO user VALUE (?, ?, ?);""",
            #     "dialect": Dialect.ANSI.value,
            # },
            {
                "query": """SELECT CASE address WHEN '5th Street' THEN 'CEO' ELSE 'Unknown' END AS person FROM user;""",
                "expected": """SELECT CASE address WHEN ? THEN ? ELSE ? END AS person FROM user;""",
                "dialect": Dialect.ANSI.value,
            },
            {
                "query": """with test as (SELECT CASE address WHEN '5th Street' THEN 'CEO' ELSE 'Unknown' END AS person FROM user) select * from test;""",  # noqa: E501
                "expected": """with test as (SELECT CASE address WHEN ? THEN ? ELSE ? END AS person FROM user) select * from test;""",  # noqa: E501
                "dialect": Dialect.ANSI.value,
            },
            {
                "query": """select * from (select * from (SELECT CASE address WHEN '5th Street' THEN 'CEO' ELSE 'Unknown' END AS person FROM user));""",  # noqa: E501
                "expected": """select * from (select * from (SELECT CASE address WHEN ? THEN ? ELSE ? END AS person FROM user));""",  # noqa: E501
                "dialect": Dialect.ANSI.value,
            },
            {
                "query": """select * from users where id > 2 and name <> 'pere';""",
                "expected": """select * from users where id > ? and name <> ?;""",
                "dialect": Dialect.ANSI.value,
            },
            {
                "query": """CREATE TABLE "db001"."table001" AS SELECT * FROM "db002"."table002" WHERE age > 18 AND name = 'John';""",  # noqa: E501
                "expected": """CREATE TABLE "db001"."table001" AS SELECT * FROM "db002"."table002" WHERE age > ? AND name = ?;""",  # noqa: E501
                "dialect": Dialect.ANSI.value,
            },
        ]

        for test_case in query_test_cases:
            # Test with all three parsers
            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlGlot",
            )
            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlFluff",
            )
            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlParse",
            )

    def test_invalid_dialect_exception(self):
        """
        Test that invalid dialect exception on SqlGlot and SqlFluff parsers.
        """
        query_test_cases = [
            {
                "query": """select * from users where id > 2 and name <> 'pere';""",
                "expected": """select * from users where id > ? and name <> ?;""",
                "dialect": "random_invalid_dialect",
            },
        ]

        for test_case in query_test_cases:

            # ValueError: Unknown dialect 'random_invalid_dialect'.
            with self.assertRaises(ValueError):
                assert_masked_query(
                    test_case["query"],
                    test_case["expected"],
                    test_case["dialect"],
                    "SqlGlot",
                )

            # KeyError: 'Unknown dialect'
            with self.assertRaises(KeyError):
                assert_masked_query(
                    test_case["query"],
                    test_case["expected"],
                    test_case["dialect"],
                    "SqlFluff",
                )

            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlParse",
            )

    def test_escaped_quotes_in_strings(self):
        """
        Test masking of queries with escaped quotes in string literals.
        """
        query_test_cases = [
            {
                "query": """SELECT * FROM user WHERE name='O''Brien' AND address='123 "Main" St';""",
                "expected": """SELECT * FROM user WHERE name=? AND address=?;""",
                "dialect": Dialect.ANSI.value,
            },
        ]

        for test_case in query_test_cases:
            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlGlot",
            )
            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlFluff",
            )
            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlParse",
            )

    def test_different_numeric_types(self):
        """
        Test masking of different numeric literal types.
        """
        query_test_cases = [
            {
                "query": """SELECT * FROM products WHERE price = 99.99 AND quantity > 100 AND discount = 0.15 AND stock_level >= 5000;""",  # noqa: E501
                "expected": """SELECT * FROM products WHERE price = ? AND quantity > ? AND discount = ? AND stock_level >= ?;""",  # noqa: E501
                "dialect": Dialect.ANSI.value,
            },
        ]

        for test_case in query_test_cases:
            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlGlot",
            )
            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlFluff",
            )
            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlParse",
            )

    def test_masking_cache(self):
        """
        Test that masked query cache works correctly.
        """
        query_test_cases = [
            {
                "query": """SELECT * FROM user WHERE id=123;""",
                "expected": """SELECT * FROM user WHERE id=?;""",
                "dialect": Dialect.ANSI.value,
            },
        ]

        for test_case in query_test_cases:

            # compute and cache
            masked_query_cache.clear()
            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlGlot",
            )

            # verify cache entry
            cache_key = (test_case["query"], test_case["dialect"])
            self.assertIn(cache_key, masked_query_cache)
            self.assertEqual(masked_query_cache[cache_key], test_case["expected"])

            # verify cache clearance
            masked_query_cache.clear()
            self.assertNotIn(cache_key, masked_query_cache)

    def test_masking_when_no_parser(self):
        """
        Test that masking works as expected when no parser is provided.
        """
        query_test_cases = [
            {
                "query": """SELECT * FROM user WHERE id=123;""",
                "expected": """SELECT * FROM user WHERE id=?;""",
                "dialect": Dialect.ANSI.value,
            },
        ]

        masked_query_cache.clear()
        masked_query = mask_query(
            query_test_cases[0]["query"],
            dialect=query_test_cases[0]["dialect"],
            parser=None,
            parser_required=False,
        )

        assert masked_query == query_test_cases[0]["expected"]

    def test_masking_when_no_parser_but_required(self):
        """
        Test that masking returns None when no parser is provided but required.
        """
        query_test_cases = [
            {
                "query": """SELECT * FROM user WHERE id=123;""",
                "expected": None,
                "dialect": Dialect.ANSI.value,
            },
        ]

        masked_query_cache.clear()
        masked_query = mask_query(
            query_test_cases[0]["query"],
            dialect=query_test_cases[0]["dialect"],
            parser=None,
            parser_required=True,
        )

        assert masked_query is None

    # Dialect specific query masking tests

    def test_postgres_typed_literals_nested_subquery(self):
        """
        Test masking of Postgres typed literals in nested subqueries.
        """
        query_test_cases = [
            {
                "query": "SELECT * FROM orders WHERE order_date = DATE '2023-10-01' AND customer_id IN (SELECT id FROM customers WHERE signup_date = TIMESTAMP '2022-01-15 10:30:00');",  # noqa: E501
                "expected": "SELECT * FROM orders WHERE order_date = DATE ? AND customer_id IN (SELECT id FROM customers WHERE signup_date = TIMESTAMP ?);",  # noqa: E501
                "dialect": Dialect.POSTGRES.value,
            }
        ]

        for test_case in query_test_cases:
            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlGlot",
            )
            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlFluff",
            )
            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlParse",
            )

    def test_mysql_implicit_typing_functions_limits_column_if(self):
        """
        Test masking of MySQL implicit typing functions like IF, LIMIT.
        """
        query_test_cases = [
            {
                "query": "SELECT IF(status = 'active', 1, 0) AS is_active, DATE(created_at) AS created_day FROM accounts WHERE score > 99.5 AND created_at BETWEEN '2024-01-01' AND '2024-12-31' ORDER BY created_at DESC LIMIT 10 OFFSET 5;",  # noqa: E501
                "expected": "SELECT IF(status = ?, ?, ?) AS is_active, DATE(created_at) AS created_day FROM accounts WHERE score > ? AND created_at BETWEEN ? AND ? ORDER BY created_at DESC LIMIT ? OFFSET ?;",  # noqa: E501
                "dialect": Dialect.MYSQL.value,
            }
        ]

        for test_case in query_test_cases:
            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlGlot",
            )
            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlFluff",
            )
            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlParse",
            )

    def test_bigquery_struct_array_unnest(self):
        """
        Test masking of BigQuery STRUCTs, ARRAYs, and UNNEST.
        """
        query_test_cases = [
            {
                "query": "SELECT u.name, u.age, a.city FROM UNNEST([STRUCT('alice' AS name, 25 AS age, [STRUCT('NY' AS city)])]) AS u, UNNEST(u.f2) AS a WHERE u.age > 21 AND a.city = 'NY';",  # noqa: E501
                "expected": "SELECT u.name, u.age, a.city FROM UNNEST([STRUCT(? AS name, ? AS age, [STRUCT(? AS city)])]) AS u, UNNEST(u.f2) AS a WHERE u.age > ? AND a.city = ?;",  # noqa: E501
                "dialect": Dialect.BIGQUERY.value,
            },
        ]

        for test_case in query_test_cases:
            # TODO: Not masking `'NY'` inside STRUCT whereas `'alice'` and `25` are masked, need to validate
            # assert_masked_query(
            #     test_case["query"],
            #     test_case["expected"],
            #     test_case["dialect"],
            #     "SqlGlot",
            # )
            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlFluff",
            )
            # TODO: Not masking `'NY'` inside STRUCT whereas `'alice'` and `25` are masked, need to validate
            # assert_masked_query(
            #     test_case["query"],
            #     test_case["expected"],
            #     test_case["dialect"],
            #     "SqlParse",
            # )

    def test_snowflake_variant_json_casting(self):
        """
        Test masking of Snowflake VARIANT/JSON data types and casting.
        """
        query_test_cases = [
            {
                "query": "SELECT data:id AS user_id, data:profile.name AS user_name, data:profile.age::INT AS user_age FROM events WHERE data:profile.age > 30 AND data:profile.status = 'active';",  # noqa: E501
                "expected": "SELECT data:id AS user_id, data:profile.name AS user_name, data:profile.age::INT AS user_age FROM events WHERE data:profile.age > ? AND data:profile.status = ?;",  # noqa: E501
                "dialect": Dialect.SNOWFLAKE.value,
            }
        ]

        for test_case in query_test_cases:
            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlGlot",
            )
            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlFluff",
            )
            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlParse",
            )

    @pytest.mark.skip(
        reason="SqlGlot and SqlFluff do not support DECLARE statement type yet."
        " Additionally multi-statement handling needs to be evaluated later."
    )
    def test_tsql_variables_convert(self):
        """
        Test masking of T-SQL variables and CONVERT function.
        """
        query_test_cases = [
            {
                "query": "DECLARE @startDate DATETIME = '2024-01-01'; DECLARE @endDate DATETIME = '2024-12-31'; SELECT * FROM events WHERE event_date BETWEEN @startDate AND @endDate;",  # noqa: E501
                "expected": "DECLARE @startDate DATETIME = '2024-01-01'; DECLARE @endDate DATETIME = '2024-12-31'; SELECT * FROM events WHERE event_date BETWEEN ? AND ?;",  # noqa: E501
                "dialect": Dialect.TSQL.value,
            }
        ]

        for test_case in query_test_cases:
            # TODO: sqlglot doesn't support analyzing statement type [declare] for
            # SQL: DECLARE @startDate DATETIME = '2024-01-01';
            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlGlot",
            )
            # TODO: sqlfluff doesn't support analyzing statement type [declare] for
            # SQL: DECLARE @startDate DATETIME = '2024-01-01';
            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlFluff",
            )
            # TODO: since our parser is designed to handle one sql statement at a
            # time, it returns last masked statement only, need to evaluate later
            # if multi-statement handling is required
            assert_masked_query(
                test_case["query"],
                test_case["expected"],
                test_case["dialect"],
                "SqlParse",
            )
