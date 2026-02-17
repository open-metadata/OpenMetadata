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
from collate_sqllineage.core.models import Location
from collate_sqllineage.core.models import Table as LineageTable

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import (
    _replace_target_table,
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

    # TODO: since default parser is sqlglot, which fails to parse CTEs properly,
    # we need to either fix sqlglot or change the default parser to test this case
    @pytest.mark.skip(
        reason="SqlGlot does not handle CTEs properly yet for column lineage."
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

    def test_replace_target_table(self):
        """
        Test the _replace_target_table function
        """
        # Create a LineageParser with a dummy UDF query
        query = "CREATE TABLE dummy_table_name AS SELECT id, name FROM source_table"
        parser = LineageParser(query, dialect=Dialect.ANSI)

        # Replace the target table with the expected name
        expected_table_name = "actual_target_table"
        _replace_target_table(parser, expected_table_name)

        # Verify the target table has been replaced
        stmt_holder = parser.parser._stmt_holders[0]
        target_tables = list(stmt_holder.write)

        # Check that we have exactly one target table with the expected name
        self.assertEqual(len(target_tables), 1)
        self.assertEqual(str(target_tables[0]), "<default>.actual_target_table")

        # Verify column lineage is preserved
        column_lineage = parser.parser.get_column_lineage()
        self.assertIsNotNone(column_lineage)

        # Check that column lineage points to the new target table
        for col_lineage in column_lineage:
            target_column = col_lineage[-1]
            self.assertEqual(str(target_column.parent), "<default>.actual_target_table")

    def test_replace_target_table_with_default_schema(self):
        """
        Test _replace_target_table with default schema removal
        """
        # Create a LineageParser with a query
        query = "CREATE TABLE dummy_table_name AS SELECT * FROM source_table"
        parser = LineageParser(query, dialect=Dialect.ANSI)

        # Replace with a name containing default schema
        expected_table_name = "<default>.actual_table"
        _replace_target_table(parser, expected_table_name)

        # Verify the target table name is correct
        # Note: LineageTable always adds <default> for tables without schema
        stmt_holder = parser.parser._stmt_holders[0]
        target_tables = list(stmt_holder.write)

        self.assertEqual(len(target_tables), 1)
        # LineageTable will add <default> back even after we remove it
        self.assertEqual(str(target_tables[0]), "<default>.actual_table")

    def test_copy_into_from_stage_not_filtered(self):
        """
        Test that Snowflake COPY INTO table FROM @stage statements are NOT filtered out
        as they provide valuable lineage information from stages to tables.
        """
        snowflake_copy_queries = [
            "COPY INTO wine_quality FROM @demo FILE_FORMAT = wine_csv_format;",
            "COPY INTO my_table FROM @my_stage",
            "COPY INTO db.schema.table FROM @external_stage FILE_FORMAT = (TYPE = CSV)",
            "copy into target_table from @s3_stage/path/to/files",
        ]

        for query in snowflake_copy_queries:
            result = LineageParser.clean_raw_query(query)
            self.assertIsNotNone(
                result,
                f"Query should NOT be filtered: {query}",
            )

    def test_generic_copy_statements_filtered(self):
        """
        Test that generic COPY statements (like PostgreSQL COPY FROM path)
        are still filtered out as they don't provide lineage value.
        """
        generic_copy_queries = [
            "COPY my_table FROM '/path/to/file.csv'",
            "COPY users FROM '/tmp/data.csv' WITH CSV HEADER",
            "COPY table_name FROM STDIN",
            "COPY orders FROM 's3://bucket/file.csv'",
        ]

        for query in generic_copy_queries:
            result = LineageParser.clean_raw_query(query)
            self.assertIsNone(
                result,
                f"Query should be filtered: {query}",
            )

    def test_copy_to_statements_filtered(self):
        """
        Test that COPY TO statements are filtered out as they are export operations.
        """
        copy_to_queries = [
            "COPY my_table TO '/path/to/file.csv'",
            "COPY (SELECT * FROM users) TO '/tmp/output.csv'",
        ]

        for query in copy_to_queries:
            result = LineageParser.clean_raw_query(query)
            self.assertIsNone(
                result,
                f"Query should be filtered: {query}",
            )

    # -------------------------------------------------------------------------
    # Snowflake Stage Lineage Tests
    # -------------------------------------------------------------------------

    def test_copy_into_stage_from_table_not_filtered(self):
        """
        Test that Snowflake COPY INTO @stage FROM table (unload) statements
        are NOT filtered out, as they provide lineage from tables to stages.
        """
        snowflake_unload_queries = [
            "COPY INTO @my_stage FROM my_table",
            "COPY INTO @db.schema.stage FROM (SELECT * FROM t)",
            "copy into @stage/path FROM table1",
            "COPY INTO @~/ FROM my_table FILE_FORMAT = (TYPE = CSV COMPRESSION = GZIP)",
            "COPY INTO @~/staged FROM sales_data",
            "COPY INTO @my_stage/daily/2024/ FROM reporting.public.daily_metrics",
            "COPY INTO @external_stage/path/ FROM (SELECT col1 FROM src_table WHERE id > 100)",
        ]

        for query in snowflake_unload_queries:
            result = LineageParser.clean_raw_query(query)
            self.assertIsNotNone(
                result,
                f"COPY INTO @stage FROM table should NOT be filtered: {query}",
            )

    def test_stage_lineage_source_as_location_type(self):
        """
        Verify that COPY INTO table FROM @stage returns Location as source
        and Table as target with correct types.
        """
        query = "COPY INTO wine_quality FROM @demo FILE_FORMAT = wine_csv_format;"
        parser = LineageParser(query, dialect=Dialect.SNOWFLAKE)

        self.assertEqual(len(parser.source_tables), 1)
        self.assertEqual(len(parser.target_tables), 1)
        self.assertIsInstance(parser.source_tables[0], Location)
        self.assertNotIsInstance(parser.source_tables[0], LineageTable)

    def test_stage_lineage_target_as_location_type(self):
        """
        Verify that COPY INTO @stage FROM table returns Table as source
        and Location as target with correct types.
        """
        query = "COPY INTO @my_stage FROM my_table"
        parser = LineageParser(query, dialect=Dialect.SNOWFLAKE)

        self.assertEqual(len(parser.source_tables), 1)
        self.assertEqual(len(parser.target_tables), 1)
        self.assertNotIsInstance(parser.target_tables[0], LineageTable)
        self.assertIsInstance(parser.target_tables[0], Location)

    def test_stage_lineage_fully_qualified_names(self):
        """
        Test stage lineage with fully qualified database.schema.stage names
        for both source and target directions.
        """
        # Stage as source (loading data into table)
        query_load = "COPY INTO db.schema.target_table FROM @db.schema.my_stage"
        parser_load = LineageParser(query_load, dialect=Dialect.SNOWFLAKE)

        self.assertEqual(len(parser_load.source_tables), 1)
        self.assertEqual(len(parser_load.target_tables), 1)
        self.assertIsInstance(parser_load.source_tables[0], Location)
        self.assertEqual(str(parser_load.source_tables[0]), "db.schema.my_stage")
        self.assertEqual(str(parser_load.target_tables[0]), "db.schema.target_table")

        # Stage as target (unloading data from table)
        query_unload = "COPY INTO @db.schema.my_stage FROM db.schema.source_table"
        parser_unload = LineageParser(query_unload, dialect=Dialect.SNOWFLAKE)

        self.assertEqual(len(parser_unload.source_tables), 1)
        self.assertEqual(len(parser_unload.target_tables), 1)
        self.assertIsInstance(parser_unload.target_tables[0], Location)
        self.assertEqual(str(parser_unload.source_tables[0]), "db.schema.source_table")
        self.assertEqual(str(parser_unload.target_tables[0]), "db.schema.my_stage")

    def test_stage_lineage_unload_with_select_subquery(self):
        """
        Test COPY INTO @stage FROM (SELECT ...) extracts the underlying
        source table correctly from the subquery.
        """
        query = (
            "COPY INTO @external_stage/path/ FROM "
            "(SELECT col1, col2 FROM db.schema.source_table WHERE id > 100)"
        )
        parser = LineageParser(query, dialect=Dialect.SNOWFLAKE)

        self.assertEqual(len(parser.source_tables), 1)
        self.assertEqual(len(parser.target_tables), 1)
        self.assertEqual(str(parser.source_tables[0]), "db.schema.source_table")
        self.assertIsInstance(parser.target_tables[0], Location)

    def test_stage_lineage_user_stage(self):
        """
        Test COPY INTO with user stage (@~/) is properly handled.
        """
        query = "COPY INTO @~/ FROM my_table FILE_FORMAT = (TYPE = CSV)"
        parser = LineageParser(query, dialect=Dialect.SNOWFLAKE)

        self.assertEqual(len(parser.source_tables), 1)
        self.assertEqual(len(parser.target_tables), 1)
        self.assertIsInstance(parser.source_tables[0], LineageTable)
        self.assertIsInstance(parser.target_tables[0], Location)

    def test_stage_lineage_with_file_format_options(self):
        """
        Test that file format options don't interfere with lineage parsing.
        """
        queries = [
            "COPY INTO my_table FROM @stage FILE_FORMAT = (TYPE = CSV SKIP_HEADER = 1)",
            "COPY INTO my_table FROM @stage FILE_FORMAT = wine_csv_format",
            "COPY INTO @stage FROM my_table FILE_FORMAT = (TYPE = PARQUET)",
            "COPY INTO my_table FROM @stage PATTERN='.*[.]csv'",
        ]

        for query in queries:
            parser = LineageParser(query, dialect=Dialect.SNOWFLAKE)
            self.assertTrue(
                len(parser.source_tables) > 0,
                f"Expected source tables for query: {query}",
            )
            self.assertTrue(
                len(parser.target_tables) > 0,
                f"Expected target tables for query: {query}",
            )
