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
Lineage Parser configuration
"""
import traceback
from collections import defaultdict
from copy import deepcopy
from logging.config import DictConfigurator
from typing import Any, Dict, List, Optional, Tuple, Union

from cached_property import cached_property
from sqlparse.sql import Comparison, Identifier, Statement

from metadata.generated.schema.type.tableUsageCount import TableColumn, TableColumnJoin
from metadata.ingestion.lineage.models import Dialect
from metadata.utils.helpers import (
    find_in_iter,
    get_formatted_entity_name,
    insensitive_match,
    insensitive_replace,
)
from metadata.utils.logger import ingestion_logger

# Prevent sqllineage from modifying the logger config
# Disable the DictConfigurator.configure method while importing LineageRunner
# pylint: disable=wrong-import-position
configure = DictConfigurator.configure
DictConfigurator.configure = lambda _: None
from sqllineage.core.models import Column, Schema, Table
from sqllineage.exceptions import SQLLineageException
from sqllineage.runner import LineageRunner
from sqllineage.sqlfluff_core.models import SqlFluffTable

# Reverting changes after import is done
DictConfigurator.configure = configure

logger = ingestion_logger()


class LineageParser:
    """
    Class that acts like a wrapper for the LineageRunner library usage
    """

    parser: LineageRunner
    query: str
    _clean_query: str

    def __init__(self, query: str, dialect: Dialect = Dialect.ANSI):
        self.query = query
        self._clean_query = self.clean_raw_query(query)
        self.parser = self._evaluate_best_parser(self._clean_query, dialect=dialect)

    @cached_property
    def involved_tables(self) -> Optional[List[Table]]:
        """
        Use the LineageRunner parser and combine
        source and intermediate tables into
        a single set.
        :return: List of involved tables
        """
        try:
            return list(
                set(self.source_tables)
                .union(set(self.intermediate_tables))
                .union(set(self.target_tables))
            )
        except SQLLineageException as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Cannot extract source table information from query [{self.query}]: {exc}"
            )
            return None

    @cached_property
    def intermediate_tables(self) -> List[Table]:
        """
        Get a list of intermediate tables
        """
        # These are @lazy_property, not properly being picked up by IDEs. Ignore the warning
        return self.retrieve_tables(self.parser.intermediate_tables)

    @cached_property
    def source_tables(self) -> List[Table]:
        """
        Get a list of source tables
        """
        # These are @lazy_property, not properly being picked up by IDEs. Ignore the warning
        return self.retrieve_tables(self.parser.source_tables)

    @cached_property
    def target_tables(self) -> List[Table]:
        """
        Get a list of target tables
        """
        # These are @lazy_property, not properly being picked up by IDEs. Ignore the warning
        return self.retrieve_tables(self.parser.target_tables)

    @cached_property
    def column_lineage(self) -> List[Union[Tuple[Column, Column]]]:
        """
        Get a list of tuples of column lineage
        """
        if self.parser._use_sqlparse:  # pylint: disable=protected-access
            return self.parser.get_column_lineage()
        column_lineage = []
        for src_column, tgt_column in self.parser.get_column_lineage():
            src_col = Column(src_column.raw_name)
            src_col._parent = src_column._parent  # pylint: disable=protected-access
            tgt_col = Column(tgt_column.raw_name)
            tgt_col._parent = tgt_column._parent  # pylint: disable=protected-access
            column_lineage.append((src_col, tgt_col))
        return column_lineage

    @cached_property
    def clean_table_list(self) -> List[str]:
        """
        Clean the table name if it has <default>.
        :return: clean table names
        """
        return [get_formatted_entity_name(str(table)) for table in self.involved_tables]

    @cached_property
    def table_aliases(self) -> Dict[str, str]:
        """
        Prepare a dictionary in the shape of {alias: table_name} from
        the parser tables
        :return: alias dict
        """
        return {
            table.alias: str(table).replace("<default>.", "")
            for table in self.involved_tables
        }

    def get_table_name_from_list(
        self,
        database_name: Optional[str],
        schema_name: Optional[str],
        table_name: str,
    ) -> Optional[str]:
        """
        Find the table name (in any format in my come)
        from the list using the given ingredients.
        :param database_name: db name
        :param schema_name: schema name
        :param table_name: table name
        :return: table name from parser info
        """
        tables = self.clean_table_list
        table = find_in_iter(element=table_name, container=tables)
        if table:
            return table

        schema_table = find_in_iter(
            element=f"{schema_name}.{table_name}", container=tables
        )
        if schema_table:
            return schema_table

        db_schema_table = find_in_iter(
            element=f"{database_name}.{schema_name}.{table_name}", container=tables
        )
        if db_schema_table:
            return db_schema_table

        logger.debug(f"Cannot find table {db_schema_table} in involved tables")
        return None

    def get_comparison_elements(
        self, identifier: Identifier
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Return the tuple table_name, column_name from each comparison element
        :param identifier: comparison identifier
        :return: table name and column name from the identifier
        """
        aliases = self.table_aliases
        values = identifier.value.split(".")
        database_name, schema_name, table_or_alias, column_name = (
            [None] * (4 - len(values))
        ) + values

        if not table_or_alias or not column_name:
            logger.debug(
                f"Cannot obtain comparison elements from identifier {identifier}"
            )
            return None, None

        alias_to_table = aliases.get(table_or_alias)
        if alias_to_table:
            return alias_to_table, column_name

        table_from_list = self.get_table_name_from_list(
            database_name=database_name,
            schema_name=schema_name,
            table_name=table_or_alias,
        )

        if not table_from_list:
            logger.debug(f"Cannot find {table_or_alias} in comparison elements")
            return None, None

        return table_from_list, column_name

    @staticmethod
    def stateful_add_table_joins(
        statement_joins: Dict[str, List[TableColumnJoin]],
        source: TableColumn,
        target: TableColumn,
    ) -> None:
        """
        Update the statement_joins dict with the new table information
        :param statement_joins: dict with state info
        :param source: source TableColumn
        :param target: target TableColumn
        """

        if source.table not in statement_joins:
            statement_joins[source.table].append(
                TableColumnJoin(tableColumn=source, joinedWith=[target])
            )

        else:
            # check if new column from same table
            table_columns = [
                join_info.tableColumn for join_info in statement_joins[source.table]
            ]
            existing_table_column = find_in_iter(
                element=source, container=table_columns
            )
            if existing_table_column:
                existing_join_info = [
                    join_info
                    for join_info in statement_joins[source.table]
                    if join_info.tableColumn == existing_table_column
                ][0]
                existing_join_info.joinedWith.append(target)
            # processing now join column from source table
            else:
                statement_joins[source.table].append(
                    TableColumnJoin(tableColumn=source, joinedWith=[target])
                )

    def stateful_add_joins_from_statement(
        self,
        join_data: Dict[str, List[TableColumnJoin]],
        statement: Statement,
    ) -> None:
        """
        Parse a single statement to pick up join information
        :param join_data: join data from previous statements
        :param statement: Parsed sql statement to process
        :return: for each table name, list all joins against other tables
        """
        # Here we want to get tokens such as `tableA.col1 = tableB.col2`
        comparisons = [
            sub for sub in statement.get_sublists() if isinstance(sub, Comparison)
        ]
        for comparison in comparisons:
            if "." not in comparison.left.value or "." not in comparison.right.value:
                logger.debug(f"Ignoring comparison {comparison}")
                continue

            table_left, column_left = self.get_comparison_elements(
                identifier=comparison.left
            )
            table_right, column_right = self.get_comparison_elements(
                identifier=comparison.right
            )

            if not table_left or not table_right:
                logger.warning(f"Cannot find ingredients from {comparison}")
                continue

            left_table_column = TableColumn(table=table_left, column=column_left)
            right_table_column = TableColumn(table=table_right, column=column_right)

            # We just send the info once, from Left -> Right.
            # The backend will prepare the symmetric information.
            self.stateful_add_table_joins(
                join_data, left_table_column, right_table_column
            )

    @cached_property
    def table_joins(self) -> Dict[str, List[TableColumnJoin]]:
        """
        For each table involved in the query, find its joins against any
        other table.
        :return: for each table name, list all joins against other tables
        """
        join_data = defaultdict(list)
        # These are @lazy_property, not properly being picked up by IDEs. Ignore the warning
        for statement in self.parser.statements_parsed:
            self.stateful_add_joins_from_statement(join_data, statement=statement)

        return join_data

    def retrieve_tables(self, tables: List[Any]) -> List[Table]:
        if not self._clean_query:
            return []
        return [
            self.clean_table_name(table)
            for table in tables
            if isinstance(table, (Table, SqlFluffTable))
        ]

    @classmethod
    def clean_raw_query(cls, raw_query: str) -> Optional[str]:
        """
        Given a raw query from any input (e.g., view definition,
        query from logs, etc.), perform a cleaning step
        before passing it to the LineageRunner
        """
        clean_query = insensitive_replace(
            raw_str=raw_query,
            to_replace=" copy grants ",  # snowflake specific
            replace_by=" ",  # remove it as it does not add any value to lineage
        )

        query_no_linebreaks = insensitive_replace(
            raw_str=clean_query.strip(),
            to_replace="\n",  # remove line breaks
            replace_by=" ",
        )

        if insensitive_match(query_no_linebreaks, ".*merge into .*when matched.*"):
            clean_query = insensitive_replace(
                raw_str=query_no_linebreaks,
                to_replace="when matched.*",  # merge into queries specific
                replace_by="",  # remove it as LineageRunner is not able to perform the lineage
            )

        # We remove queries of the type 'COPY table FROM path' since they are data manipulation statement and do not
        # provide value for user
        if insensitive_match(clean_query, "^COPY.*"):
            return None

        return clean_query.strip()

    @staticmethod
    def clean_table_name(table: Union[Table, SqlFluffTable]) -> Table:
        """
        Clean table name by:
        - Removing brackets from the beginning and end of the table and schema name

        Args:
            table (Table): table to be cleaned

        Returns:
            Copy of the table object with cleaned names
        """
        # keep using Table object
        if isinstance(table, SqlFluffTable):
            clean_table = Table("")
            clean_table.raw_name = table.raw_name
            clean_table.alias = table.alias
            clean_table.schema = Schema(table.schema.raw_name)
        else:
            clean_table = deepcopy(table)
        if insensitive_match(clean_table.raw_name, r"\[.*\]"):
            clean_table.raw_name = insensitive_replace(
                clean_table.raw_name, r"\[(.*)\]", r"\1"
            )
        if clean_table.schema.raw_name and insensitive_match(
            clean_table.schema.raw_name, r"\[.*\]"
        ):
            clean_table.schema.raw_name = insensitive_replace(
                clean_table.schema.raw_name, r"\[(.*)\]", r"\1"
            )
        return clean_table

    @staticmethod
    def _evaluate_best_parser(
        query: str, dialect: Dialect = Dialect.ANSI
    ) -> LineageRunner:
        sqlfluff_count = 0
        try:
            lr_sqlfluff = LineageRunner(
                query, dialect=dialect.value, use_sqlparse=False
            )
            sqlfluff_count = len(lr_sqlfluff.get_column_lineage()) + len(
                set(lr_sqlfluff.source_tables).union(
                    set(lr_sqlfluff.target_tables).union(
                        set(lr_sqlfluff.intermediate_tables)
                    )
                )
            )
        except Exception:
            logger.debug(
                f"Lineage with SqlFluff failed for the [{dialect.value}] query: [{query}]"
            )
            lr_sqlfluff = None

        lr_sqlparser = LineageRunner(query, dialect=dialect.value)
        try:
            sqlparser_count = len(lr_sqlparser.get_column_lineage()) + len(
                set(lr_sqlparser.source_tables).union(
                    set(lr_sqlparser.target_tables).union(
                        set(lr_sqlparser.intermediate_tables)
                    )
                )
            )
        except Exception:
            # if both runner have failed we return the usual one
            return lr_sqlfluff if lr_sqlfluff else lr_sqlparser

        if lr_sqlfluff:
            # if sqlparser retrieve more lineage info that sqlfluff
            if sqlparser_count > sqlfluff_count:
                logger.debug(
                    "Lineage computed with SqlFluff did not perform as expected "
                    f"for the [{dialect.value}] query: [{query}]"
                )
                return lr_sqlparser
            return lr_sqlfluff
        return lr_sqlparser
