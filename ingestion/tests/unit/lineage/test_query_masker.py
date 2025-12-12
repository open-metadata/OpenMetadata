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

from ingestion.tests.unit.lineage.queries.helpers import assert_masked_query
from metadata.ingestion.lineage.masker import masked_query_cache
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
