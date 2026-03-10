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
Dialect-specific GROUP BY / ORDER BY ordinal preservation tests

Tests that verify integer ordinals in GROUP BY and ORDER BY clauses
are preserved (not replaced with '?') across all supported SQL dialects.
"""
from unittest import TestCase

from ingestion.tests.unit.lineage.masker.helpers import assert_masked_query
from metadata.ingestion.lineage.models import Dialect


class TestQueryMaskerOrdinalPreservation(TestCase):
    """
    Tests that GROUP BY / ORDER BY ordinals are preserved across all
    SQL dialects. Each test exercises dialect-specific syntax features
    alongside ordinal references.
    """

    # ──────────────────────────────────────────────────────────────────────────
    # GROUP BY / ORDER BY ordinal preservation — edge cases
    # ──────────────────────────────────────────────────────────────────────────

    def test_ordinal_positions_in_nested_subqueries(self):
        """
        Test ordinal preservation in deeply nested subqueries, including
        subqueries inside FROM and WHERE clauses.
        """
        query_test_cases = [
            {
                # Subquery in FROM with GROUP BY, outer query has ORDER BY
                "query": "SELECT sub.a, sub.cnt FROM (SELECT a, COUNT(*) AS cnt FROM t WHERE x = 10 GROUP BY 1 HAVING COUNT(*) > 2 ORDER BY 1) sub ORDER BY 2 DESC LIMIT 5;",  # noqa: E501
                "expected": "SELECT sub.a, sub.cnt FROM (SELECT a, COUNT(*) AS cnt FROM t WHERE x = ? GROUP BY 1 HAVING COUNT(*) > ? ORDER BY 1) sub ORDER BY 2 DESC LIMIT ?;",  # noqa: E501
                "dialect": Dialect.ANSI.value,
            },
            {
                # Subquery in FROM — no GROUP BY ordinals
                "query": "SELECT * FROM (SELECT a, COUNT(*) FROM t WHERE x = 10 GROUP BY 1) sub WHERE sub.a > 5;",  # noqa: E501
                "expected": "SELECT * FROM (SELECT a, COUNT(*) FROM t WHERE x = ? GROUP BY 1) sub WHERE sub.a > ?;",  # noqa: E501
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

    def test_ordinal_positions_union_all(self):
        """
        Test ordinal preservation across UNION ALL branches, each with
        its own GROUP BY / ORDER BY clauses.
        """
        query_test_cases = [
            {
                "query": "SELECT a FROM t1 WHERE x = 1 GROUP BY 1 UNION ALL SELECT b FROM t2 WHERE y = 2 GROUP BY 1;",  # noqa: E501
                "expected": "SELECT a FROM t1 WHERE x = ? GROUP BY 1 UNION ALL SELECT b FROM t2 WHERE y = ? GROUP BY 1;",  # noqa: E501
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

    def test_ordinal_positions_multiple_ctes(self):
        """
        Test ordinal preservation when multiple CTEs each have GROUP BY
        and the outer query has LIMIT.
        """
        query_test_cases = [
            {
                "query": "WITH c1 AS (SELECT a FROM t1 WHERE x = 1 GROUP BY 1), c2 AS (SELECT b FROM t2 WHERE y = 2 GROUP BY 1 ORDER BY 1) SELECT * FROM c1 JOIN c2 ON c1.a = c2.b LIMIT 100;",  # noqa: E501
                "expected": "WITH c1 AS (SELECT a FROM t1 WHERE x = ? GROUP BY 1), c2 AS (SELECT b FROM t2 WHERE y = ? GROUP BY 1 ORDER BY 1) SELECT * FROM c1 JOIN c2 ON c1.a = c2.b LIMIT ?;",  # noqa: E501
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

    def test_order_by_nulls_first_last(self):
        """
        Test that ORDER BY with NULLS FIRST / NULLS LAST preserves ordinal
        integers. ASC, DESC, NULLS FIRST, NULLS LAST are modifier keywords
        that should NOT reset the ordinal context.
        """
        query_test_cases = [
            {
                "query": "SELECT a, b FROM t ORDER BY 1 NULLS FIRST, 2 NULLS LAST;",
                "expected": "SELECT a, b FROM t ORDER BY 1 NULLS FIRST, 2 NULLS LAST;",
                "dialect": Dialect.POSTGRES.value,
            },
            {
                "query": "SELECT a, b FROM t ORDER BY 1 ASC NULLS FIRST, 2 DESC NULLS LAST;",  # noqa: E501
                "expected": "SELECT a, b FROM t ORDER BY 1 ASC NULLS FIRST, 2 DESC NULLS LAST;",  # noqa: E501
                "dialect": Dialect.POSTGRES.value,
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

    def test_group_by_having_masks_literals(self):
        """
        Test that HAVING clause after GROUP BY correctly masks its literals
        even though GROUP BY context was active just before.
        """
        query_test_cases = [
            {
                # HAVING with string comparison — string must be masked
                "query": "SELECT dept, COUNT(*) FROM emp WHERE status = 'active' GROUP BY 1 HAVING dept <> 'HR' ORDER BY 1;",  # noqa: E501
                "expected": "SELECT dept, COUNT(*) FROM emp WHERE status = ? GROUP BY 1 HAVING dept <> ? ORDER BY 1;",  # noqa: E501
                "dialect": Dialect.ANSI.value,
            },
            {
                # HAVING with numeric comparison
                "query": "SELECT dept, SUM(salary) FROM emp GROUP BY 1 HAVING SUM(salary) > 100000;",  # noqa: E501
                "expected": "SELECT dept, SUM(salary) FROM emp GROUP BY 1 HAVING SUM(salary) > ?;",  # noqa: E501
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

    def test_group_by_column_names_not_affected(self):
        """
        Test that GROUP BY / ORDER BY with column names (not ordinal integers)
        are unaffected by the ordinal preservation logic.
        """
        query_test_cases = [
            {
                "query": "SELECT dept, COUNT(*) FROM emp WHERE status = 'active' GROUP BY dept ORDER BY dept DESC;",  # noqa: E501
                "expected": "SELECT dept, COUNT(*) FROM emp WHERE status = ? GROUP BY dept ORDER BY dept DESC;",  # noqa: E501
                "dialect": Dialect.ANSI.value,
            },
            {
                # GROUP BY expression — expressions are not ordinals
                "query": "SELECT EXTRACT(YEAR FROM dt) AS yr, COUNT(*) FROM t WHERE x > 5 GROUP BY EXTRACT(YEAR FROM dt) ORDER BY 1;",  # noqa: E501
                "expected": "SELECT EXTRACT(YEAR FROM dt) AS yr, COUNT(*) FROM t WHERE x > ? GROUP BY EXTRACT(YEAR FROM dt) ORDER BY 1;",  # noqa: E501
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

    def test_group_by_string_literal_still_masked(self):
        """
        Test that string literals inside GROUP BY are still masked.
        Only integer ordinals are preserved — string literals should always
        be masked regardless of clause.
        """
        query_test_cases = [
            {
                "query": "SELECT 'constant' AS label, COUNT(*) FROM t GROUP BY 'constant';",  # noqa: E501
                "expected": "SELECT ? AS label, COUNT(*) FROM t GROUP BY ?;",
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

    def test_group_by_float_literal_still_masked(self):
        """
        Test that float literals in GROUP BY are still masked.
        Only integer ordinals (positional references) are preserved.
        Floats cannot be valid ordinal positions.
        """
        query_test_cases = [
            {
                "query": "SELECT 1.5, COUNT(*) FROM t GROUP BY 1.5;",
                "expected": "SELECT ?, COUNT(*) FROM t GROUP BY ?;",
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

    def test_window_function_order_by_ordinal(self):
        """
        Test that ORDER BY inside a window function OVER() clause also
        preserves integer ordinals.
        """
        query_test_cases = [
            {
                "query": "SELECT a, ROW_NUMBER() OVER (PARTITION BY dept ORDER BY 1) AS rn FROM t WHERE x = 5;",  # noqa: E501
                "expected": "SELECT a, ROW_NUMBER() OVER (PARTITION BY dept ORDER BY 1) AS rn FROM t WHERE x = ?;",  # noqa: E501
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

    def test_insert_select_with_group_by_ordinal(self):
        """
        Test that INSERT...SELECT with GROUP BY ordinal positions correctly
        preserves them while masking WHERE literals.
        """
        query_test_cases = [
            {
                "query": "INSERT INTO summary SELECT dept, COUNT(*) FROM emp WHERE status = 'active' GROUP BY 1;",  # noqa: E501
                "expected": "INSERT INTO summary SELECT dept, COUNT(*) FROM emp WHERE status = ? GROUP BY 1;",  # noqa: E501
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

    def test_bigquery_interval_with_group_by_ordinal(self):
        """
        Test BigQuery INTERVAL + DATETIME_SUB with GROUP BY ordinals,
        closely matching the reported Payoneer query pattern.
        """
        query_test_cases = [
            {
                "query": "SELECT * FROM t WHERE dt >= DATETIME_SUB(CURRENT_DATETIME(), INTERVAL 6 MONTH) GROUP BY 1, 2, 3 ORDER BY 1;",  # noqa: E501
                "expected": "SELECT * FROM t WHERE dt >= DATETIME_SUB(CURRENT_DATETIME(), INTERVAL ? MONTH) GROUP BY 1, 2, 3 ORDER BY 1;",  # noqa: E501
                "dialect": Dialect.BIGQUERY.value,
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

    def test_grouping_sets_ordinals_preserved(self):
        """
        Test that integer ordinals inside GROUPING SETS are preserved.
        This is especially important for the SqlParse path, where the
        standalone GROUPING keyword must not reset GROUP BY context.
        """
        query_test_cases = [
            {
                "query": "SELECT a, b FROM t WHERE x > 5 GROUP BY GROUPING SETS((1), (2), (1, 2)) ORDER BY 1;",  # noqa: E501
                "expected": "SELECT a, b FROM t WHERE x > ? GROUP BY GROUPING SETS((1), (2), (1, 2)) ORDER BY 1;",  # noqa: E501
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

    def test_rollup_ordinals_preserved(self):
        """
        Test that integer ordinals inside GROUP BY ROLLUP are preserved.
        sqlparse currently tokenizes ROLLUP as Token.Name (not Keyword),
        so it inherits context naturally. The ROLLUP keyword is also
        defensively allowlisted in masker.py to guard against future
        sqlparse tokenization changes.
        """
        query_test_cases = [
            {
                "query": "SELECT a, b FROM t WHERE x > 5 GROUP BY ROLLUP(1, 2) ORDER BY 1;",
                "expected": "SELECT a, b FROM t WHERE x > ? GROUP BY ROLLUP(1, 2) ORDER BY 1;",
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

    def test_cube_ordinals_preserved(self):
        """
        Test that integer ordinals inside GROUP BY CUBE are preserved.
        sqlparse currently tokenizes CUBE as Token.Name (not Keyword),
        so it inherits context naturally. The CUBE keyword is also
        defensively allowlisted in masker.py to guard against future
        sqlparse tokenization changes.
        """
        query_test_cases = [
            {
                "query": "SELECT a, b, c FROM t WHERE x > 5 GROUP BY CUBE(1, 2, 3) ORDER BY 1;",
                "expected": "SELECT a, b, c FROM t WHERE x > ? GROUP BY CUBE(1, 2, 3) ORDER BY 1;",
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

    def test_where_group_by_order_by_context_isolation(self):
        """
        Test that WHERE integers are masked, GROUP BY/ORDER BY integers are
        preserved, and the context correctly resets between clauses.
        """
        query_test_cases = [
            {
                "query": "SELECT a, COUNT(*) FROM t WHERE id > 100 AND score < 50 GROUP BY 1 ORDER BY 1;",  # noqa: E501
                "expected": "SELECT a, COUNT(*) FROM t WHERE id > ? AND score < ? GROUP BY 1 ORDER BY 1;",  # noqa: E501
                "dialect": Dialect.ANSI.value,
            },
            {
                # GROUP BY no WHERE — pure ordinal GROUP BY
                "query": "SELECT dept, COUNT(*) FROM emp GROUP BY 1;",
                "expected": "SELECT dept, COUNT(*) FROM emp GROUP BY 1;",
                "dialect": Dialect.ANSI.value,
            },
            {
                # ORDER BY with column name then LIMIT — column name preserved, LIMIT masked
                "query": "SELECT a, b FROM t WHERE name = 'alice' ORDER BY a DESC;",
                "expected": "SELECT a, b FROM t WHERE name = ? ORDER BY a DESC;",
                "dialect": Dialect.ANSI.value,
            },
            {
                # ORDER BY integer then LIMIT
                "query": "SELECT a, b FROM t ORDER BY 2 DESC LIMIT 10;",
                "expected": "SELECT a, b FROM t ORDER BY 2 DESC LIMIT ?;",
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

    # ──────────────────────────────────────────────────────────────────────────
    # Individual dialect tests
    # ──────────────────────────────────────────────────────────────────────────

    def test_dialect_bigquery_ordinals(self):
        """
        BigQuery: DATETIME_SUB, INTERVAL, STRING_AGG, CTE, UNION ALL
        with GROUP BY / ORDER BY ordinals preserved.
        """
        query = (
            "WITH base AS ("
            "SELECT region, product, revenue "
            "FROM sales "
            "WHERE sale_date >= DATETIME_SUB(CURRENT_DATETIME(), INTERVAL 30 DAY)"
            ") "
            "SELECT region, STRING_AGG(product, ', ') AS products, SUM(revenue) AS total "
            "FROM base "
            "GROUP BY 1 "
            "ORDER BY 3 DESC"
        )
        expected = (
            "WITH base AS ("
            "SELECT region, product, revenue "
            "FROM sales "
            "WHERE sale_date >= DATETIME_SUB(CURRENT_DATETIME(), INTERVAL ? DAY)"
            ") "
            "SELECT region, STRING_AGG(product, ?) AS products, SUM(revenue) AS total "
            "FROM base "
            "GROUP BY 1 "
            "ORDER BY 3 DESC"
        )
        dialect = Dialect.BIGQUERY.value
        for parser in ("SqlGlot", "SqlFluff", "SqlParse"):
            assert_masked_query(query, expected, dialect, parser)

    def test_dialect_snowflake_ordinals(self):
        """
        Snowflake: VARIANT JSON path, ::FLOAT casting, window function
        with GROUP BY ordinals preserved.
        """
        query = (
            "SELECT data:customer::STRING AS customer, "
            "data:amount::FLOAT AS amount, "
            "ROW_NUMBER() OVER (PARTITION BY data:customer::STRING ORDER BY data:amount::FLOAT DESC) AS rn "
            "FROM raw_events "
            "WHERE data:amount::FLOAT > 100.0 "
            "GROUP BY 1, 2 "
            "ORDER BY 1"
        )
        expected = (
            "SELECT data:customer::STRING AS customer, "
            "data:amount::FLOAT AS amount, "
            "ROW_NUMBER() OVER (PARTITION BY data:customer::STRING ORDER BY data:amount::FLOAT DESC) AS rn "
            "FROM raw_events "
            "WHERE data:amount::FLOAT > ? "
            "GROUP BY 1, 2 "
            "ORDER BY 1"
        )
        dialect = Dialect.SNOWFLAKE.value
        for parser in ("SqlGlot", "SqlFluff", "SqlParse"):
            assert_masked_query(query, expected, dialect, parser)

    def test_dialect_mysql_ordinals(self):
        """
        MySQL: IF function, BETWEEN, IN clause with GROUP BY ordinals.
        """
        query = (
            "SELECT IF(status = 1, 'active', 'inactive') AS status_label, "
            "COUNT(*) AS cnt "
            "FROM users "
            "WHERE age BETWEEN 18 AND 65 "
            "AND dept_id IN (1, 2, 3) "
            "GROUP BY 1 "
            "ORDER BY 2 DESC "
            "LIMIT 10"
        )
        expected = (
            "SELECT IF(status = ?, ?, ?) AS status_label, "
            "COUNT(*) AS cnt "
            "FROM users "
            "WHERE age BETWEEN ? AND ? "
            "AND dept_id IN (?, ?, ?) "
            "GROUP BY 1 "
            "ORDER BY 2 DESC "
            "LIMIT ?"
        )
        dialect = Dialect.MYSQL.value
        for parser in ("SqlGlot", "SqlFluff", "SqlParse"):
            assert_masked_query(query, expected, dialect, parser)

    def test_dialect_postgres_ordinals(self):
        """
        Postgres: typed literals (DATE, TIMESTAMP), NULLS FIRST/LAST,
        CASE WHEN with GROUP BY ordinals.
        """
        query = (
            "SELECT CASE WHEN amount > 1000 THEN 'high' ELSE 'low' END AS tier, "
            "COUNT(*) "
            "FROM orders "
            "WHERE created_at > TIMESTAMP '2024-01-01 00:00:00' "
            "GROUP BY 1 "
            "ORDER BY 2 DESC NULLS LAST"
        )
        expected = (
            "SELECT CASE WHEN amount > ? THEN ? ELSE ? END AS tier, "
            "COUNT(*) "
            "FROM orders "
            "WHERE created_at > TIMESTAMP ? "
            "GROUP BY 1 "
            "ORDER BY 2 DESC NULLS LAST"
        )
        dialect = Dialect.POSTGRES.value
        for parser in ("SqlGlot", "SqlFluff", "SqlParse"):
            assert_masked_query(query, expected, dialect, parser)

    def test_dialect_redshift_ordinals(self):
        """
        Redshift: ILIKE, CTE with GROUP BY ordinals.
        """
        query = (
            "WITH filtered AS ("
            "SELECT category, sales FROM products WHERE name ILIKE '%widget%'"
            ") "
            "SELECT category, SUM(sales) "
            "FROM filtered "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        expected = (
            "WITH filtered AS ("
            "SELECT category, sales FROM products WHERE name ILIKE ?"
            ") "
            "SELECT category, SUM(sales) "
            "FROM filtered "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        dialect = Dialect.REDSHIFT.value
        for parser in ("SqlGlot", "SqlFluff", "SqlParse"):
            assert_masked_query(query, expected, dialect, parser)

    def test_dialect_hive_ordinals(self):
        """
        Hive: aggregations with GROUP BY ordinals.
        SqlGlot does not support Hive dialect.
        """
        query = (
            "SELECT department, COUNT(*) AS cnt "
            "FROM employees "
            "WHERE salary > 50000 "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        expected = (
            "SELECT department, COUNT(*) AS cnt "
            "FROM employees "
            "WHERE salary > ? "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        dialect = Dialect.HIVE.value
        for parser in ("SqlFluff", "SqlParse"):
            assert_masked_query(query, expected, dialect, parser)

    def test_dialect_trino_ordinals(self):
        """
        Trino: APPROX_DISTINCT, TIMESTAMP literal with GROUP BY ordinals.
        """
        query = (
            "SELECT region, APPROX_DISTINCT(user_id) AS unique_users "
            "FROM events "
            "WHERE event_time > TIMESTAMP '2024-06-01 00:00:00' "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        expected = (
            "SELECT region, APPROX_DISTINCT(user_id) AS unique_users "
            "FROM events "
            "WHERE event_time > TIMESTAMP ? "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        dialect = Dialect.TRINO.value
        for parser in ("SqlGlot", "SqlFluff", "SqlParse"):
            assert_masked_query(query, expected, dialect, parser)

    def test_dialect_clickhouse_ordinals(self):
        """
        ClickHouse: toDate function, HAVING with GROUP BY ordinals.
        """
        query = (
            "SELECT toDate(event_time) AS event_day, COUNT(*) AS cnt "
            "FROM events "
            "WHERE event_time >= toDate('2024-01-01') "
            "GROUP BY 1 "
            "HAVING cnt > 100 "
            "ORDER BY 1"
        )
        expected = (
            "SELECT toDate(event_time) AS event_day, COUNT(*) AS cnt "
            "FROM events "
            "WHERE event_time >= toDate(?) "
            "GROUP BY 1 "
            "HAVING cnt > ? "
            "ORDER BY 1"
        )
        dialect = Dialect.CLICKHOUSE.value
        for parser in ("SqlGlot", "SqlFluff", "SqlParse"):
            assert_masked_query(query, expected, dialect, parser)

    def test_dialect_databricks_ordinals(self):
        """
        Databricks: basic GROUP BY ordinals with LIMIT.
        """
        query = (
            "SELECT category, SUM(amount) AS total "
            "FROM transactions "
            "WHERE amount > 0 "
            "GROUP BY 1 "
            "ORDER BY 2 DESC "
            "LIMIT 50"
        )
        expected = (
            "SELECT category, SUM(amount) AS total "
            "FROM transactions "
            "WHERE amount > ? "
            "GROUP BY 1 "
            "ORDER BY 2 DESC "
            "LIMIT ?"
        )
        dialect = Dialect.DATABRICKS.value
        for parser in ("SqlGlot", "SqlFluff", "SqlParse"):
            assert_masked_query(query, expected, dialect, parser)

    def test_dialect_tsql_ordinals(self):
        """
        TSQL: square-bracket identifiers with GROUP BY ordinals.
        """
        query = (
            "SELECT [department], COUNT(*) AS cnt "
            "FROM [employees] "
            "WHERE [salary] > 50000 "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        expected = (
            "SELECT [department], COUNT(*) AS cnt "
            "FROM [employees] "
            "WHERE [salary] > ? "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        dialect = Dialect.TSQL.value
        for parser in ("SqlGlot", "SqlFluff", "SqlParse"):
            assert_masked_query(query, expected, dialect, parser)

    def test_dialect_oracle_ordinals(self):
        """
        Oracle: GROUP BY ordinals with HAVING.
        """
        query = (
            "SELECT department_id, COUNT(*) AS cnt "
            "FROM employees "
            "WHERE salary > 30000 "
            "GROUP BY 1 "
            "HAVING COUNT(*) > 5 "
            "ORDER BY 2 DESC"
        )
        expected = (
            "SELECT department_id, COUNT(*) AS cnt "
            "FROM employees "
            "WHERE salary > ? "
            "GROUP BY 1 "
            "HAVING COUNT(*) > ? "
            "ORDER BY 2 DESC"
        )
        dialect = Dialect.ORACLE.value
        for parser in ("SqlGlot", "SqlFluff", "SqlParse"):
            assert_masked_query(query, expected, dialect, parser)

    def test_dialect_duckdb_ordinals(self):
        """
        DuckDB: GROUP BY ordinals with ORDER BY.
        """
        query = (
            "SELECT region, AVG(score) AS avg_score "
            "FROM results "
            "WHERE score > 0 "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        expected = (
            "SELECT region, AVG(score) AS avg_score "
            "FROM results "
            "WHERE score > ? "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        dialect = Dialect.DUCKDB.value
        for parser in ("SqlGlot", "SqlFluff", "SqlParse"):
            assert_masked_query(query, expected, dialect, parser)

    def test_dialect_sparksql_ordinals(self):
        """
        SparkSQL: SUM aggregation with GROUP BY ordinals.
        """
        query = (
            "SELECT product, SUM(quantity) AS total_qty "
            "FROM orders "
            "WHERE quantity > 0 "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        expected = (
            "SELECT product, SUM(quantity) AS total_qty "
            "FROM orders "
            "WHERE quantity > ? "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        dialect = Dialect.SPARKSQL.value
        for parser in ("SqlGlot", "SqlFluff", "SqlParse"):
            assert_masked_query(query, expected, dialect, parser)

    def test_dialect_sqlite_ordinals(self):
        """
        SQLite: AVG with HAVING and GROUP BY ordinals.
        """
        query = (
            "SELECT category, AVG(price) AS avg_price "
            "FROM products "
            "WHERE price > 0 "
            "GROUP BY 1 "
            "HAVING AVG(price) > 10 "
            "ORDER BY 2"
        )
        expected = (
            "SELECT category, AVG(price) AS avg_price "
            "FROM products "
            "WHERE price > ? "
            "GROUP BY 1 "
            "HAVING AVG(price) > ? "
            "ORDER BY 2"
        )
        dialect = Dialect.SQLITE.value
        for parser in ("SqlGlot", "SqlFluff", "SqlParse"):
            assert_masked_query(query, expected, dialect, parser)

    def test_dialect_athena_ordinals(self):
        """
        Athena: partition pruning with GROUP BY ordinals.
        """
        query = (
            "SELECT year, month, COUNT(*) AS cnt "
            "FROM events "
            "WHERE year = 2024 AND month >= 6 "
            "GROUP BY 1, 2 "
            "ORDER BY 1, 2"
        )
        expected = (
            "SELECT year, month, COUNT(*) AS cnt "
            "FROM events "
            "WHERE year = ? AND month >= ? "
            "GROUP BY 1, 2 "
            "ORDER BY 1, 2"
        )
        dialect = Dialect.ATHENA.value
        for parser in ("SqlGlot", "SqlFluff", "SqlParse"):
            assert_masked_query(query, expected, dialect, parser)

    def test_dialect_exasol_ordinals(self):
        """
        Exasol: GROUP BY ordinals.
        """
        query = (
            "SELECT status, COUNT(*) AS cnt "
            "FROM tickets "
            "WHERE priority > 3 "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        expected = (
            "SELECT status, COUNT(*) AS cnt "
            "FROM tickets "
            "WHERE priority > ? "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        dialect = Dialect.EXASOL.value
        for parser in ("SqlGlot", "SqlFluff", "SqlParse"):
            assert_masked_query(query, expected, dialect, parser)

    def test_dialect_materialize_ordinals(self):
        """
        Materialize: GROUP BY ordinals.
        """
        query = (
            "SELECT source, COUNT(*) AS cnt "
            "FROM stream_data "
            "WHERE value > 0 "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        expected = (
            "SELECT source, COUNT(*) AS cnt "
            "FROM stream_data "
            "WHERE value > ? "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        dialect = Dialect.MATERIALIZE.value
        for parser in ("SqlGlot", "SqlFluff", "SqlParse"):
            assert_masked_query(query, expected, dialect, parser)

    def test_dialect_teradata_ordinals(self):
        """
        Teradata: GROUP BY ordinals.
        """
        query = (
            "SELECT region, SUM(sales) AS total_sales "
            "FROM revenue "
            "WHERE sales > 1000 "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        expected = (
            "SELECT region, SUM(sales) AS total_sales "
            "FROM revenue "
            "WHERE sales > ? "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        dialect = Dialect.TERADATA.value
        for parser in ("SqlGlot", "SqlFluff", "SqlParse"):
            assert_masked_query(query, expected, dialect, parser)

    def test_dialect_vertica_ordinals(self):
        """
        Vertica: GROUP BY ordinals — SqlGlot does not support Vertica.
        """
        query = (
            "SELECT department, COUNT(*) AS cnt "
            "FROM staff "
            "WHERE hire_year > 2020 "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        expected = (
            "SELECT department, COUNT(*) AS cnt "
            "FROM staff "
            "WHERE hire_year > ? "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        dialect = Dialect.VERTICA.value
        for parser in ("SqlFluff", "SqlParse"):
            assert_masked_query(query, expected, dialect, parser)

    def test_dialect_mariadb_ordinals(self):
        """
        MariaDB: GROUP BY ordinals — SqlGlot does not support MariaDB.
        """
        query = (
            "SELECT category, COUNT(*) AS cnt "
            "FROM products "
            "WHERE price > 10 "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        expected = (
            "SELECT category, COUNT(*) AS cnt "
            "FROM products "
            "WHERE price > ? "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        dialect = Dialect.MARIADB.value
        for parser in ("SqlFluff", "SqlParse"):
            assert_masked_query(query, expected, dialect, parser)

    def test_dialect_db2_ordinals(self):
        """
        DB2: GROUP BY ordinals — SqlGlot does not support DB2.
        """
        query = (
            "SELECT department, AVG(salary) AS avg_sal "
            "FROM employees "
            "WHERE salary > 40000 "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        expected = (
            "SELECT department, AVG(salary) AS avg_sal "
            "FROM employees "
            "WHERE salary > ? "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        dialect = Dialect.DB2.value
        for parser in ("SqlFluff", "SqlParse"):
            assert_masked_query(query, expected, dialect, parser)

    def test_dialect_impala_ordinals(self):
        """
        Impala: GROUP BY ordinals — SqlGlot does not support Impala.
        """
        query = (
            "SELECT region, SUM(revenue) AS total "
            "FROM sales "
            "WHERE revenue > 0 "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        expected = (
            "SELECT region, SUM(revenue) AS total "
            "FROM sales "
            "WHERE revenue > ? "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        dialect = Dialect.IMPALA.value
        for parser in ("SqlFluff", "SqlParse"):
            assert_masked_query(query, expected, dialect, parser)

    # ──────────────────────────────────────────────────────────────────────────
    # Parametric sweep across ALL dialects
    # ──────────────────────────────────────────────────────────────────────────

    def test_all_dialects_group_by_ordinals(self):
        """
        Parametric test: verify GROUP BY / ORDER BY ordinals are preserved
        across ALL 24 dialects with SqlFluff and SqlParse (always supported),
        and additionally with SqlGlot where supported.
        """
        query = (
            "SELECT a, COUNT(*) "
            "FROM t "
            "WHERE x > 1 "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )
        expected = (
            "SELECT a, COUNT(*) "
            "FROM t "
            "WHERE x > ? "
            "GROUP BY 1 "
            "ORDER BY 2 DESC"
        )

        sqlglot_unsupported = {
            Dialect.DB2.value,
            Dialect.IMPALA.value,
            Dialect.SOQL.value,
            Dialect.MARIADB.value,
            Dialect.VERTICA.value,
        }

        for dialect in Dialect:
            for parser in ("SqlFluff", "SqlParse"):
                assert_masked_query(query, expected, dialect.value, parser)
            if dialect.value not in sqlglot_unsupported:
                assert_masked_query(query, expected, dialect.value, "SqlGlot")
