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

# Prevent sqllineage from modifying the logger config
# Disable the DictConfigurator.configure method while importing LineageRunner
from logging.config import DictConfigurator
from unittest import TestCase

from metadata.generated.schema.type.tableUsageCount import TableColumn, TableColumnJoin
from metadata.ingestion.processor.query_parser import (
    get_clean_parser_table_list,
    get_involved_tables_from_parser,
    get_parser_table_aliases,
    get_table_joins,
)

configure = DictConfigurator.configure
DictConfigurator.configure = lambda _: None
from sqllineage.runner import LineageRunner

# Reverting changes after import is done
DictConfigurator.configure = configure


class QueryParserTests(TestCase):
    """
    Check methods from query_parser.py
    """

    query = col_lineage = """
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

    parser = LineageRunner(col_lineage)

    def test_involved_tables(self):
        tables = {str(table) for table in get_involved_tables_from_parser(self.parser)}
        self.assertEqual(
            tables, {"db.grault", "db.holis", "<default>.foo", "db.random"}
        )

    def test_clean_parser_table_list(self):
        tables = get_involved_tables_from_parser(self.parser)
        clean_tables = set(get_clean_parser_table_list(tables))
        self.assertEqual(clean_tables, {"db.grault", "db.holis", "foo", "db.random"})

    def test_parser_table_aliases(self):
        tables = get_involved_tables_from_parser(self.parser)
        aliases = get_parser_table_aliases(tables)
        self.assertEqual(
            aliases, {"b": "db.grault", "c": "db.holis", "a": "foo", "d": "db.random"}
        )

    def test_get_table_joins(self):
        """
        main logic point
        """
        tables = get_involved_tables_from_parser(self.parser)

        clean_tables = get_clean_parser_table_list(tables)
        aliases = get_parser_table_aliases(tables)

        joins = get_table_joins(
            parser=self.parser, tables=clean_tables, aliases=aliases
        )

        self.assertEqual(
            joins["foo"],
            [
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
            ],
        )
