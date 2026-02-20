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
Validate query parser logic
"""

from unittest import TestCase

import pytest
from collate_sqllineage.core.models import Column, Location, Table

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

    # TODO: Fix this case at the earliest
    @pytest.mark.skip(
        reason="Flaky with sqlglot parser, returns no column lineage or correct column lineage randomly."
    )
    def test_ctes_column_lineage(self):
        """
        Validate we obtain information from Common Table Expressions
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

        expected_lineage = [
            (
                Column("testdb.public.users.id"),
                Column("testdb.public.target.id"),
            ),
            (
                Column("testdb.public.users.name"),
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

    def test_copy_query(self):
        """
        Validate Copy query is skipped appropriately without any errors
        """
        query = """COPY MY_TABLE col1,col2,col3
        FROM 's3://bucket/schema/table.csv'
        WITH CREDENTIALS ''
        REGION 'US-east-2'
        """
        expected_lineage = []
        expected_tables = set()

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

    def test_clean_raw_query_create_trigger(self):
        """
        Validate CREATE TRIGGER query cleaning logic - should return None
        """
        query = "CREATE TRIGGER last_updated BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE PROCEDURE public.last_updated()"
        self.assertEqual(
            LineageParser.clean_raw_query(query),
            None,
        )

        # Test with OR REPLACE
        query_or_replace = "CREATE OR REPLACE TRIGGER my_trigger AFTER INSERT ON my_table FOR EACH ROW EXECUTE FUNCTION my_func()"
        self.assertEqual(
            LineageParser.clean_raw_query(query_or_replace),
            None,
        )

    def test_clean_raw_query_create_function(self):
        """
        Validate CREATE FUNCTION query cleaning logic - should return None
        """
        query = """CREATE FUNCTION public.last_updated() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.last_update = CURRENT_TIMESTAMP;
    RETURN NEW;
END $$"""
        self.assertEqual(
            LineageParser.clean_raw_query(query),
            None,
        )

        # Test with OR REPLACE
        query_or_replace = "CREATE OR REPLACE FUNCTION my_schema.my_func() RETURNS void AS $$ BEGIN NULL; END $$ LANGUAGE plpgsql"
        self.assertEqual(
            LineageParser.clean_raw_query(query_or_replace),
            None,
        )

    def test_clean_raw_query_create_procedure(self):
        """
        Validate CREATE PROCEDURE query cleaning logic - should return None
        """
        query = (
            "CREATE PROCEDURE my_procedure() LANGUAGE plpgsql AS $$ BEGIN NULL; END $$"
        )
        self.assertEqual(
            LineageParser.clean_raw_query(query),
            None,
        )

        # Test with OR REPLACE
        query_or_replace = "CREATE OR REPLACE PROCEDURE my_schema.my_proc() AS $$ BEGIN NULL; END $$ LANGUAGE SQL"
        self.assertEqual(
            LineageParser.clean_raw_query(query_or_replace),
            None,
        )

    # -------------------------------------------------------------------------
    # Snowflake Stage Lineage Tests
    # -------------------------------------------------------------------------

    def test_clean_raw_query_copy_into_table_from_stage(self):
        """
        Validate COPY INTO table FROM @stage queries are NOT filtered out.
        These provide lineage from Snowflake stages to tables.
        """
        queries = [
            "COPY INTO wine_quality FROM @demo FILE_FORMAT = wine_csv_format;",
            "COPY INTO my_table FROM @my_stage",
            "COPY INTO db.schema.table FROM @external_stage FILE_FORMAT = (TYPE = CSV)",
            "copy into target_table from @s3_stage/path/to/files",
            "COPY INTO my_table FROM @my_db.my_schema.my_stage FILE_FORMAT=(TYPE=CSV)",
        ]

        for query in queries:
            result = LineageParser.clean_raw_query(query)
            self.assertIsNotNone(
                result,
                f"COPY INTO table FROM @stage should NOT be filtered: {query}",
            )

    def test_clean_raw_query_copy_into_stage_from_table(self):
        """
        Validate COPY INTO @stage FROM table (unload) queries are NOT filtered out.
        These provide lineage from tables to Snowflake stages.
        """
        queries = [
            "COPY INTO @my_stage FROM my_table",
            "COPY INTO @db.schema.stage FROM (SELECT * FROM t)",
            "copy into @stage/path FROM table1",
            "COPY INTO @~/ FROM my_table FILE_FORMAT = (TYPE = CSV COMPRESSION = GZIP)",
            "COPY INTO @~/staged FROM sales_data",
            "COPY INTO @my_stage/daily/2024/ FROM reporting.public.daily_metrics",
            "COPY INTO @external_stage/path/ FROM (SELECT col1, col2 FROM db.schema.source_table WHERE id > 100)",
        ]

        for query in queries:
            result = LineageParser.clean_raw_query(query)
            self.assertIsNotNone(
                result,
                f"COPY INTO @stage FROM table should NOT be filtered: {query}",
            )

    def test_clean_raw_query_generic_copy_filtered(self):
        """
        Validate generic COPY statements (e.g. PostgreSQL) are still filtered out.
        """
        queries = [
            "COPY my_table FROM '/path/to/file.csv'",
            "COPY users FROM '/tmp/data.csv' WITH CSV HEADER",
            "COPY table_name FROM STDIN",
            "COPY orders FROM 's3://bucket/file.csv'",
            "COPY my_table TO '/path/to/file.csv'",
            "COPY (SELECT * FROM users) TO '/tmp/output.csv'",
        ]

        for query in queries:
            result = LineageParser.clean_raw_query(query)
            self.assertIsNone(
                result,
                f"Generic COPY statement should be filtered: {query}",
            )

    def test_copy_into_table_from_stage_lineage(self):
        """
        Validate COPY INTO table FROM @stage produces correct lineage:
        - Source should be a Location (the stage)
        - Target should be a Table
        """
        query = "COPY INTO wine_quality FROM @demo FILE_FORMAT = wine_csv_format;"
        parser = LineageParser(query, dialect=Dialect.SNOWFLAKE)

        self.assertEqual(len(parser.source_tables), 1)
        self.assertEqual(len(parser.target_tables), 1)
        self.assertIsInstance(parser.source_tables[0], Location)
        self.assertIsInstance(parser.target_tables[0], Table)
        self.assertEqual(str(parser.source_tables[0]), "<default>.demo")
        self.assertEqual(str(parser.target_tables[0]), "<default>.wine_quality")

    def test_copy_into_stage_from_table_lineage(self):
        """
        Validate COPY INTO @stage FROM table produces correct lineage:
        - Source should be a Table
        - Target should be a Location (the stage)
        """
        query = "COPY INTO @my_stage FROM my_table"
        parser = LineageParser(query, dialect=Dialect.SNOWFLAKE)

        self.assertEqual(len(parser.source_tables), 1)
        self.assertEqual(len(parser.target_tables), 1)
        self.assertIsInstance(parser.source_tables[0], Table)
        self.assertIsInstance(parser.target_tables[0], Location)
        self.assertEqual(str(parser.source_tables[0]), "<default>.my_table")
        self.assertEqual(str(parser.target_tables[0]), "<default>.my_stage")

    def test_copy_into_stage_from_select_lineage(self):
        """
        Validate COPY INTO @stage FROM (SELECT ...) produces correct lineage:
        - Source should be the underlying Table from the SELECT
        - Target should be a Location (the stage)
        """
        query = "COPY INTO @db.schema.my_stage FROM (SELECT col1, col2 FROM my_table)"
        parser = LineageParser(query, dialect=Dialect.SNOWFLAKE)

        self.assertEqual(len(parser.source_tables), 1)
        self.assertEqual(len(parser.target_tables), 1)
        self.assertIsInstance(parser.source_tables[0], Table)
        self.assertIsInstance(parser.target_tables[0], Location)
        self.assertEqual(str(parser.source_tables[0]), "<default>.my_table")
        self.assertEqual(str(parser.target_tables[0]), "db.schema.my_stage")

    def test_copy_into_fully_qualified_stage_lineage(self):
        """
        Validate COPY INTO table FROM @db.schema.stage with fully qualified stage name.
        """
        query = (
            "COPY INTO my_table FROM @my_db.my_schema.my_stage FILE_FORMAT=(TYPE=CSV)"
        )
        parser = LineageParser(query, dialect=Dialect.SNOWFLAKE)

        self.assertEqual(len(parser.source_tables), 1)
        self.assertEqual(len(parser.target_tables), 1)
        self.assertIsInstance(parser.source_tables[0], Location)
        self.assertIsInstance(parser.target_tables[0], Table)
        self.assertEqual(str(parser.source_tables[0]), "my_db.my_schema.my_stage")
        self.assertEqual(str(parser.target_tables[0]), "<default>.my_table")

    def test_copy_into_stage_with_path_lineage(self):
        """
        Validate COPY INTO @stage/path/to/data queries produce Location targets.
        """
        query = "COPY INTO @my_stage/daily/2024/ FROM reporting.public.daily_metrics"
        parser = LineageParser(query, dialect=Dialect.SNOWFLAKE)

        self.assertEqual(len(parser.source_tables), 1)
        self.assertEqual(len(parser.target_tables), 1)
        self.assertIsInstance(parser.source_tables[0], Table)
        self.assertIsInstance(parser.target_tables[0], Location)
        self.assertEqual(str(parser.source_tables[0]), "reporting.public.daily_metrics")

    def test_copy_into_case_insensitivity(self):
        """
        Validate that COPY INTO stage queries work with mixed case.
        """
        query = "copy INTO @MY_STAGE from MY_TABLE"
        parser = LineageParser(query, dialect=Dialect.SNOWFLAKE)

        self.assertEqual(len(parser.source_tables), 1)
        self.assertEqual(len(parser.target_tables), 1)
        self.assertIsInstance(parser.source_tables[0], Table)
        self.assertIsInstance(parser.target_tables[0], Location)

    def test_clean_table_name_location_at_symbol_removal(self):
        """
        Validate clean_table_name removes leading @ from Location raw_name.
        Note: The Location class already strips @ internally, so this tests
        the defensive logic in clean_table_name.
        """
        loc = Location("@STAGE_01")
        self.assertEqual(loc.raw_name, "STAGE_01")

        cleaned = LineageParser.clean_table_name(loc)
        self.assertIsInstance(cleaned, Location)
        self.assertEqual(cleaned.raw_name, "STAGE_01")

    def test_clean_table_name_preserves_location_schema(self):
        """
        Validate clean_table_name preserves schema info on Location objects.
        """
        loc = Location("@DB.SCHEMA.STAGE_01")
        cleaned = LineageParser.clean_table_name(loc)
        self.assertIsInstance(cleaned, Location)
        self.assertEqual(cleaned.raw_name, "STAGE_01")
        self.assertEqual(str(cleaned.schema), "db.schema")

    def test_clean_table_name_table_unchanged(self):
        """
        Validate clean_table_name still works for regular Table objects.
        """
        table = Table("my_table")
        cleaned = LineageParser.clean_table_name(table)
        self.assertIsInstance(cleaned, Table)
        self.assertEqual(cleaned.raw_name, "my_table")

    def test_clean_table_name_bracketed_location(self):
        """
        Validate clean_table_name handles bracketed Location names.
        """
        loc = Location("[STAGE_01]")
        cleaned = LineageParser.clean_table_name(loc)
        self.assertIsInstance(cleaned, Location)
        self.assertEqual(cleaned.raw_name, "STAGE_01")

    def test_retrieve_tables_with_location(self):
        """
        Validate retrieve_tables includes Location objects in the result.
        """
        query = "COPY INTO my_table FROM @my_stage"
        parser = LineageParser(query, dialect=Dialect.SNOWFLAKE)

        locations = [t for t in parser.source_tables if isinstance(t, Location)]
        tables = [t for t in parser.target_tables if isinstance(t, Table)]
        self.assertEqual(len(locations), 1)
        self.assertEqual(len(tables), 1)

    def test_involved_tables_with_stage_lineage(self):
        """
        Validate involved_tables includes both Table and Location for stage queries.
        """
        query = "COPY INTO my_table FROM @my_stage"
        parser = LineageParser(query, dialect=Dialect.SNOWFLAKE)

        involved = parser.involved_tables
        self.assertIsNotNone(involved)
        self.assertEqual(len(involved), 2)

        type_names = {type(t).__name__ for t in involved}
        self.assertIn("Table", type_names)
        self.assertIn("Location", type_names)

    def test_standard_copy_query_no_lineage(self):
        """
        Validate standard COPY query without stage produces no lineage.
        """
        query = """COPY MY_TABLE col1,col2,col3
        FROM 's3://bucket/schema/table.csv'
        WITH CREDENTIALS ''
        REGION 'US-east-2'
        """
        parser = LineageParser(query)
        self.assertEqual(parser.source_tables, [])
        self.assertEqual(parser.target_tables, [])
        self.assertEqual(parser.column_lineage, [])
