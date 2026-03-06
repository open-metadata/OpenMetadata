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
Dialect-specific SQL syntax masking tests

Tests for masking queries that use dialect-specific syntax features
(typed literals, VARIANT paths, STRUCTs, DECLARE, etc.).
"""
from unittest import TestCase

import pytest

from ingestion.tests.unit.lineage.masker.helpers import assert_masked_query
from metadata.ingestion.lineage.models import Dialect


class TestQueryMaskerDialectSpecific(TestCase):
    """
    Tests for dialect-specific SQL syntax that requires special masking handling.
    Each test targets a specific dialect's unique syntax features.
    """

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
