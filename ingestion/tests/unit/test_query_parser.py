#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Validate query parser logic
"""

from unittest import TestCase

from sqllineage.core.models import Column

from metadata.generated.schema.type.tableUsageCount import TableColumn, TableColumnJoin
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import LineageParser


class QueryParserTests(TestCase):
    """
    Check methods from query_parser.py
    """

    col_lineage = """
        SELECT
          a.col1,
          a.col2 + b.col2 AS col2,
          case 
            when col1 = 3 then 'hello'
            else 'bye'
          end as new_col
        FROM foo a
        JOIN db.grault b
          ON a.col1 = b.col1
        JOIN db.holis c
          ON a.col1 = c.abc
        JOIN db.random d
          ON a.col2 = d.col2
        WHERE a.col3 = 'abc'
    """

    parser = LineageParser(col_lineage)
    parser_with_dialect = LineageParser(col_lineage, dialect=Dialect.TSQL)

    def test_involved_tables(self):
        expected_tables = {"db.grault", "db.holis", "<default>.foo", "db.random"}
        tables = {str(table) for table in self.parser.involved_tables}
        self.assertEqual(tables, expected_tables)
        tables = {str(table) for table in self.parser_with_dialect.involved_tables}
        self.assertEqual(tables, expected_tables)

    def test_clean_parser_table_list(self):
        expected_tables = {"db.grault", "db.holis", "foo", "db.random"}
        clean_tables = set(self.parser.clean_table_list)
        self.assertEqual(clean_tables, expected_tables)
        clean_tables = set(self.parser_with_dialect.clean_table_list)
        self.assertEqual(clean_tables, expected_tables)

    def test_bracketed_parser_table_list(self):
        expected_tables = {"test_schema.test_view", "test_table"}
        parser = LineageParser(
            "create view [test_schema].[test_view] as select * from [test_table];"
        )
        clean_tables = set(parser.clean_table_list)
        self.assertEqual(clean_tables, expected_tables)
        parser = LineageParser(
            "create view [test_schema].[test_view] as select * from [test_table];",
            dialect=Dialect.TSQL,
        )
        clean_tables = set(parser.clean_table_list)
        self.assertEqual(clean_tables, expected_tables)

    def test_parser_table_aliases(self):
        expected_tables = {
            "b": "db.grault",
            "c": "db.holis",
            "a": "foo",
            "d": "db.random",
        }
        aliases = self.parser.table_aliases
        self.assertEqual(aliases, expected_tables)
        aliases = self.parser_with_dialect.table_aliases
        self.assertEqual(aliases, expected_tables)

    def test_get_table_joins(self):
        """
        main logic point
        """
        expected_joins = [
            TableColumnJoin(
                tableColumn=TableColumn(table="foo", column="col1"),
                joinedWith=[
                    TableColumn(table="db.grault", column="col1"),
                    TableColumn(table="db.holis", column="abc"),
                ],
            ),
            TableColumnJoin(
                tableColumn=TableColumn(table="foo", column="col2"),
                joinedWith=[
                    TableColumn(table="db.random", column="col2"),
                ],
            ),
        ]

        joins = self.parser.table_joins

        self.assertEqual(
            joins["foo"],
            expected_joins,
        )

        joins = self.parser_with_dialect.table_joins

        self.assertEqual(
            joins["foo"],
            expected_joins,
        )

    def test_capitals(self):
        """
        Example on how LineageRunner keeps capitals
        for column names
        """

        query = """
         SELECT
           USERS.ID,
           li.id
        FROM TESTDB.PUBLIC.USERS
        JOIN testdb.PUBLIC."lowercase_users" li
          ON USERS.id = li.ID
        ;
        """

        expected_joins = [
            TableColumnJoin(
                tableColumn=TableColumn(
                    table="testdb.public.users", column="id"
                ),  # lowercase col
                joinedWith=[
                    TableColumn(
                        table="testdb.public.lowercase_users", column="ID"
                    ),  # uppercase col
                ],
            ),
        ]

        parser = LineageParser(query)

        joins = parser.table_joins

        self.assertEqual(
            joins["testdb.public.users"],
            expected_joins,
        )

        parser = LineageParser(query, dialect=Dialect.MYSQL)

        joins = parser.table_joins

        self.assertEqual(
            joins["testdb.public.users"],
            expected_joins,
        )

    def test_clean_raw_query_copy_grants(self):
        """
        Validate COPY GRANT query cleaning logic
        """
        query = "create or replace view my_view copy grants as select * from my_table"
        self.assertEqual(
            LineageParser.clean_raw_query(query),
            "create or replace view my_view as select * from my_table",
        )

    def test_clean_raw_query_merge_into(self):
        """
        Validate MERGE INTO query cleaning logic
        """
        query = """
            /* comment */ merge into table_1 using (select a, b from table_2) when matched update set t.a = 'value' 
            when not matched then insert (table_1.a, table_2.b) values ('value1', 'value2')
        """
        self.assertEqual(
            LineageParser.clean_raw_query(query),
            "/* comment */ merge into table_1 using (select a, b from table_2)",
        )

    def test_clean_raw_query_copy_from(self):
        """
        Validate COPY FROM query cleaning logic
        """
        query = "COPY my_schema.my_table FROM 's3://bucket/path/object.csv';"
        self.assertEqual(
            LineageParser.clean_raw_query(query),
            None,
        )

    def test_ctes_column_lineage(self):
        """
        Validate we obtain information from Comon Table Expressions
        """
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

        expected_tables = {"testdb.public.users"}
        expected_lineage = [
            (
                Column("testdb.public.users.id"),
                Column("cte_table.id"),
                Column("cte_table2.id"),
                Column("testdb.public.target.id"),
            ),
            (
                Column("testdb.public.users.name"),
                Column("cte_table.name"),
                Column("cte_table2.name"),
                Column("testdb.public.target.name"),
            ),
        ]

        parser = LineageParser(query)
        tables = {str(table) for table in parser.source_tables}
        self.assertEqual(tables, {"testdb.public.users"})
        self.assertEqual(
            parser.column_lineage,
            expected_lineage,
        )

        parser = LineageParser(query, dialect=Dialect.MYSQL)
        tables = {str(table) for table in parser.source_tables}
        self.assertEqual(tables, {"testdb.public.users"})
        self.assertEqual(
            parser.column_lineage,
            expected_lineage,
        )

    def test_table_with_single_comment(self):
        """
        Validate we obtain information from Comon Table Expressions
        """
        query = """CREATE TABLE TESTDB.PUBLIC.TARGET AS 
        SELECT
            ID,
            -- A comment here
            NAME
        FROM TESTDB.PUBLIC.USERS
        ;
        """
        expected_tables = {"testdb.public.users", "testdb.public.target"}
        expected_lineage = [
            (Column("testdb.public.users.id"), Column("testdb.public.target.id")),
            (
                Column("testdb.public.users.name"),
                Column("testdb.public.target.name"),
            ),
        ]

        parser = LineageParser(query)
        tables = {str(table) for table in parser.involved_tables}
        self.assertEqual(tables, expected_tables)
        self.assertEqual(
            parser.column_lineage,
            expected_lineage,
        )

        parser = LineageParser(query, Dialect.MYSQL)
        tables = {str(table) for table in parser.involved_tables}
        self.assertEqual(tables, expected_tables)
        self.assertEqual(
            parser.column_lineage,
            expected_lineage,
        )

    def test_table_with_aliases(self):
        """
        Validate we obtain information from Comon Table Expressions
        """
        query = """CREATE TABLE TESTDB.PUBLIC.TARGET AS 
        SELECT
            ID AS new_identifier,
            NAME new_name
        FROM TESTDB.PUBLIC.USERS
        ;
        """
        expected_lineage = [
            (
                Column("testdb.public.users.id"),
                Column("testdb.public.target.new_identifier"),
            ),
            (
                Column("testdb.public.users.name"),
                Column("testdb.public.target.new_name"),
            ),
        ]
        expected_tables = {"testdb.public.users", "testdb.public.target"}

        parser = LineageParser(query)
        tables = {str(table) for table in parser.involved_tables}
        self.assertEqual(tables, expected_tables)
        self.assertEqual(
            parser.column_lineage,
            expected_lineage,
        )

        parser = LineageParser(query, Dialect.MYSQL)
        tables = {str(table) for table in parser.involved_tables}
        self.assertEqual(tables, expected_tables)
        self.assertEqual(
            parser.column_lineage,
            expected_lineage,
        )
