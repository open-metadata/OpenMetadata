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
sql lineage utils tests
"""
import uuid
from unittest import TestCase

import pytest
from collate_sqllineage.runner import SQLPARSE_DIALECT

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.lineage.masker import mask_query
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import (
    get_column_lineage,
    get_table_fqn_from_query_name,
    populate_column_lineage_map,
)
from metadata.utils.logger import Loggers

QUERY = [
    "CREATE TABLE MYTABLE2 AS SELECT * FROM MYTABLE1;",
    "CREATE TABLE MYTABLE3 AS SELECT ID, NAME FROM MYTABLE1",
    "CREATE VIEW MYVIEW2 AS SELECT NAME, CITY FROM MYTABLE1;",
    "INSERT INTO MYTABLE5 SELECT ID, NAME, CITY FROM MYTABLE1;",
]
EXPECTED_LINEAGE_MAP = [
    {"<default>.mytable2": {"<default>.mytable1": [("*", "*")]}},
    {"<default>.mytable3": {"<default>.mytable1": [("ID", "ID"), ("NAME", "NAME")]}},
    {"<default>.myview2": {"<default>.mytable1": [("CITY", "CITY"), ("NAME", "NAME")]}},
    {
        "<default>.mytable5": {
            "<default>.mytable1": [("CITY", "CITY"), ("ID", "ID"), ("NAME", "NAME")]
        }
    },
]


class SqlLineageTest(TestCase):
    """
    SQL Lineage Utility Tests
    """

    def test_populate_column_lineage_map(self):
        for i, query in enumerate(QUERY):
            lineage_parser = LineageParser(query)
            raw_column_lineage = lineage_parser.column_lineage
            lineage_map = populate_column_lineage_map(raw_column_lineage)
            self.assertEqual(lineage_map, EXPECTED_LINEAGE_MAP[i])

    def test_get_column_lineage_select_all(self):
        """
        Method to test column wildcard
        """
        # Given
        column_lineage_map = {
            "testdb.public.target": {"testdb.public.users": [("*", "*")]}
        }
        to_entity = Table(
            id=uuid.uuid4(),
            name="target",
            fullyQualifiedName="testdb.public.target",
            columns=[
                {
                    "name": "id",
                    "dataType": "NUMBER",
                    "fullyQualifiedName": "testdb.public.target.id",
                },
                {
                    "name": "otherCol",
                    "dataType": "NUMBER",
                    "fullyQualifiedName": "testdb.public.target.otherCol",
                },
            ],
        )
        from_entity = Table(
            id=uuid.uuid4(),
            name="users",
            fullyQualifiedName="testdb.public.users",
            columns=[
                {
                    "name": "id",
                    "dataType": "NUMBER",
                    "fullyQualifiedName": "testdb.public.users.id",
                }
            ],
        )
        # When
        col_lineage = get_column_lineage(
            to_entity=to_entity,
            to_table_raw_name="testdb.public.target",
            from_entity=from_entity,
            from_table_raw_name="testdb.public.users",
            column_lineage_map=column_lineage_map,
        )
        # Then
        assert len(col_lineage) == 1

    def test_populate_column_lineage_map_select_all(self):
        """
        Method to test column lineage map populate func
        """
        # Given
        query = """CREATE TABLE TESTDB.PUBLIC.TARGET AS
        SELECT * FROM TESTDB.PUBLIC.USERS
        ;
        """
        lineage_parser = LineageParser(query)
        raw_column_lineage = lineage_parser.column_lineage
        # When
        lineage_map = populate_column_lineage_map(raw_column_lineage)
        # Then
        self.assertEqual(
            lineage_map, {"testdb.public.target": {"testdb.public.users": [("*", "*")]}}
        )

    def test_populate_column_lineage_map_ctes(self):
        """
        Method to test column lineage map populate func with ctes
        """
        # Given
        query = """CREATE TABLE TESTDB.PUBLIC.TARGET AS
         WITH cte_table AS (
           SELECT
             USERS.ID,
             USERS.NAME
           FROM TESTDB.PUBLIC.USERS
        ),
        cte_table2 AS (
           SELECT
              ID,
              NAME
           FROM cte_table
        )        
        SELECT 
          ID,
          NAME
        FROM cte_table2
        ;
        """
        lineage_parser = LineageParser(query)
        raw_column_lineage = lineage_parser.column_lineage
        # When
        lineage_map = populate_column_lineage_map(raw_column_lineage)
        # Then
        self.assertEqual(
            lineage_map,
            {
                "testdb.public.target": {
                    "testdb.public.users": [("ID", "ID"), ("NAME", "NAME")]
                }
            },
        )

    @pytest.mark.skip(reason="It is flaky and must be reviewed.")
    def test_time_out_is_reached(self):
        """
        Method to test timeout
        """
        # Given
        query = """
        create table my_example_table as
        select *
        from (
            values
            {values}
        ) as my_data_example (value1, value2, value3, value4, value5)
        qualify row_number() over (partition by value1, value2 order by my_data_example is not null desc) = 1
        """
        values_format = "\t('value1{a}','value2{b}','value{c}','value{d}','value{e}')"
        values = [values_format.format(a=0, b=0, c=0, d=0, e=0)]
        for num in range(1, 2000):
            values.insert(
                0, values_format.format(a=num, b=num, c=num, d=num, e=num) + ","
            )
        # When
        with self.assertLogs(Loggers.INGESTION.value, level="DEBUG") as logger:
            LineageParser(
                query.format(values="\n".join(values)),
                dialect=Dialect.SNOWFLAKE,
                timeout_seconds=1,
            )
            # Then
            self.assertTrue(
                any(
                    "Parser has been running for more than 1 seconds." in log
                    for log in logger.output
                ),
                "Parser finished before the 1 expected seconds!",
            )

    def test_table_name_from_query(self):
        """
        Method to test get_table_fqn_from_query_name func
        """
        raw_query_name = "test.tab"

        self.assertEqual(
            get_table_fqn_from_query_name(raw_query_name), (None, "test", "tab")
        )

        raw_query_name = "db.test.tab"

        self.assertEqual(
            get_table_fqn_from_query_name(raw_query_name), ("db", "test", "tab")
        )

        raw_query_name = "tab"

        self.assertEqual(
            get_table_fqn_from_query_name(raw_query_name), (None, None, "tab")
        )

        raw_query_name = "project.dataset.info_schema.tab"

        self.assertEqual(
            get_table_fqn_from_query_name(raw_query_name), (None, None, "tab")
        )

    def test_query_masker(self):
        query_list = [
            (
                """SELECT * FROM user WHERE id=1234 AND name='Alice' AND birthdate=DATE '2023-01-01';""",
                Dialect.MYSQL.value,
            ),
            (
                """insert into user values ('mayur',123,'my random address 1'), ('mayur',123,'my random address 1');""",
                Dialect.ANSI.value,
            ),
            (
                """SELECT * FROM user WHERE address = '5th street' and name = 'john';""",
                Dialect.ANSI.value,
            ),
            (
                """INSERT INTO user VALUE ('John', '19', '5TH Street');""",
                Dialect.ANSI.value,
            ),
            (
                """SELECT CASE address WHEN '5th Street' THEN 'CEO' ELSE 'Unknown' END AS person FROM user;""",
                Dialect.ANSI.value,
            ),
            (
                """with test as (SELECT CASE address WHEN '5th Street' THEN 'CEO' ELSE 'Unknown' END AS person FROM user) select * from test;""",
                Dialect.ANSI.value,
            ),
            (
                """select * from (select * from (SELECT CASE address WHEN '5th Street' THEN 'CEO' ELSE 'Unknown' END AS person FROM user));""",
                Dialect.ANSI.value,
            ),
            (
                """select * from users where id > 2 and name <> 'pere';""",
                Dialect.ANSI.value,
            ),
            (
                """select * from users where id > 2 and name <> 'pere';""",
                "random",
            ),
            (
                """CREATE TABLE "db001"."table001" AS SELECT * FROM "db002"."table002" WHERE age > 18 AND name = 'John';""",
                SQLPARSE_DIALECT,  # test with sqlparse
            ),
            (
                """CREATE TABLE "db001"."table001" AS SELECT * FROM "db002"."table002" WHERE age > 18 AND name = 'John';""",
                Dialect.ANSI.value,  # test with sqlfluff
            ),
        ]

        expected_query_list = [
            """SELECT * FROM user WHERE id=? AND name=? AND birthdate=DATE ?;""",
            """insert into user values (?,?,?), (?,?,?);""",
            """SELECT * FROM user WHERE address = ? and name = ?;""",
            """INSERT INTO user VALUE (?, ?, ?);""",
            """SELECT CASE address WHEN ? THEN ? ELSE ? END AS person FROM user;""",
            """with test as (SELECT CASE address WHEN ? THEN ? ELSE ? END AS person FROM user) select * from test;""",
            """select * from (select * from (SELECT CASE address WHEN ? THEN ? ELSE ? END AS person FROM user));""",
            """select * from users where id > ? and name <> ?;""",
            """select * from users where id > ? and name <> ?;""",
            """CREATE TABLE "db001"."table001" AS SELECT * FROM "db002"."table002" WHERE age > ? AND name = ?;""",
            """CREATE TABLE "db001"."table001" AS SELECT * FROM "db002"."table002" WHERE age > ? AND name = ?;""",
        ]

        for i, query in enumerate(query_list):
            self.assertEqual(mask_query(query[0], query[1]), expected_query_list[i])
