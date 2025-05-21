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
Lineage Parser configuration
"""
import traceback
from collections import defaultdict
from copy import deepcopy
from logging.config import DictConfigurator
from typing import Any, Dict, List, Optional, Tuple, Union

import sqlparse
from cached_property import cached_property
from collate_sqllineage import SQLPARSE_DIALECT
from collate_sqllineage.core.models import Column, DataFunction, Table
from collate_sqllineage.exceptions import SQLLineageException
from collate_sqllineage.runner import LineageRunner
from sqlparse.sql import Comparison, Identifier, Parenthesis, Statement

from metadata.generated.schema.type.tableUsageCount import TableColumn, TableColumnJoin
from metadata.ingestion.lineage.masker import mask_query
from metadata.ingestion.lineage.models import Dialect
from metadata.utils.helpers import (
    find_in_iter,
    get_formatted_entity_name,
    insensitive_match,
    insensitive_replace,
)
from metadata.utils.logger import ingestion_logger
from metadata.utils.timeout import timeout

# Prevent sqllineage from modifying the logger config
# Disable the DictConfigurator.configure method while importing LineageRunner

configure = DictConfigurator.configure
DictConfigurator.configure = lambda _: None

# Reverting changes after import is done
DictConfigurator.configure = configure

logger = ingestion_logger()

# max lineage parsing wait in second when using specific dialect
LINEAGE_PARSING_TIMEOUT = 10


class LineageParser:
    """
    Class that acts like a wrapper for the LineageRunner library usage
    """

    parser: LineageRunner
    query: str
    _clean_query: str

    def __init__(
        self,
        query: str,
        dialect: Dialect = Dialect.ANSI,
        timeout_seconds: int = LINEAGE_PARSING_TIMEOUT,
    ):
        self.query = query
        self.query_parsing_success = True
        self.query_parsing_failure_reason = None
        self.dialect = dialect
        self.masked_query = None
        self._clean_query = self.clean_raw_query(query)
        self.parser = self._evaluate_best_parser(
            self._clean_query, dialect=dialect, timeout_seconds=timeout_seconds
        )
        if self.masked_query is None:
            self.masked_query = mask_query(self._clean_query, parser=self.parser)

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
                f"Cannot extract source table information from query [{self.masked_query or self.query}]: {exc}"
            )
            return None

    @cached_property
    def intermediate_tables(self) -> List[Table]:
        """
        Get a list of intermediate tables
        """
        if self.parser:
            # These are @lazy_property, not properly being picked up by IDEs. Ignore the warning
            return self.retrieve_tables(self.parser.intermediate_tables)
        return []

    @cached_property
    def source_tables(self) -> List[Union[Table, DataFunction]]:
        """
        Get a list of source tables
        """
        if self.parser:
            # These are @lazy_property, not properly being picked up by IDEs. Ignore the warning
            return self.retrieve_tables(self.parser.source_tables)
        return []

    @cached_property
    def target_tables(self) -> List[Table]:
        """
        Get a list of target tables
        """
        if self.parser:
            # These are @lazy_property, not properly being picked up by IDEs. Ignore the warning
            return self.retrieve_tables(self.parser.target_tables)
        return []

    # pylint: disable=protected-access
    @cached_property
    def column_lineage(self) -> List[Tuple[Column, Column]]:
        """
        Get a list of tuples of column lineage
        """
        column_lineage = []
        if self.parser is None:
            return []
        try:
            if self.parser._dialect == SQLPARSE_DIALECT:
                return self.parser.get_column_lineage()

            for col_lineage in self.parser.get_column_lineage():
                # In case of column level lineage it is possible that we get
                # two or more columns as there might be some intermediate columns
                # but the source columns will be the first value and
                # the target column always will be the last columns
                src_column = col_lineage[0]
                tgt_column = col_lineage[-1]
                src_col = Column(src_column.raw_name)
                src_col._parent = src_column._parent  # pylint: disable=protected-access
                tgt_col = Column(tgt_column.raw_name)
                tgt_col._parent = tgt_column._parent  # pylint: disable=protected-access
                column_lineage.append((src_col, tgt_col))
        except Exception as err:
            logger.warning(f"Failed to fetch column level lineage due to: {err}")
            logger.debug(traceback.format_exc())
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

        if len(values) > 4:
            logger.debug(f"Invalid comparison element from identifier: {identifier}")
            return None, None

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
        sql_statement: str,
    ) -> None:
        """
        Parse a single statement to pick up join information
        :param join_data: join data from previous statements
        :param sql_statement: Parsed sql statement to process
        :return: for each table name, list all joins against other tables
        """
        # Here we want to get tokens such as `(tableA.col1 = tableB.col2)`
        statement: Statement = sqlparse.parse(sql_statement)[0]
        comparisons: List[Comparison] = []
        for sub in statement.get_sublists():
            if isinstance(sub, Parenthesis):
                sub = (
                    sub._groupable_tokens[0]  # pylint: disable=protected-access
                    if len(sub._groupable_tokens)  # pylint: disable=protected-access
                    else sub
                )
            if isinstance(sub, Comparison):
                comparisons.append(sub)

        for comparison in comparisons:
            try:
                if (
                    "." not in comparison.left.value
                    or "." not in comparison.right.value
                ):
                    logger.debug(f"Ignoring comparison {comparison}")
                    continue

                table_left, column_left = self.get_comparison_elements(
                    identifier=comparison.left
                )
                table_right, column_right = self.get_comparison_elements(
                    identifier=comparison.right
                )

                if not table_left or not table_right:
                    logger.debug(
                        f"Can't extract table names when parsing JOIN information from {comparison}"
                    )
                    logger.debug(f"Query: {self.masked_query or self.query}")
                    continue

                left_table_column = TableColumn(table=table_left, column=column_left)
                right_table_column = TableColumn(table=table_right, column=column_right)

                # We just send the info once, from Left -> Right.
                # The backend will prepare the symmetric information.
                self.stateful_add_table_joins(
                    join_data, left_table_column, right_table_column
                )
            except Exception as exc:
                logger.debug(f"Cannot process comparison {comparison}: {exc}")
                logger.debug(traceback.format_exc())

    @cached_property
    def table_joins(self) -> Dict[str, List[TableColumnJoin]]:
        """
        For each table involved in the query, find its joins against any
        other table.
        :return: for each table name, list all joins against other tables
        """
        join_data = defaultdict(list)
        if self.parser is None:
            return join_data
        # These are @lazy_property, not properly being picked up by IDEs. Ignore the warning
        for statement in self.parser.statements():
            self.stateful_add_joins_from_statement(join_data, sql_statement=statement)

        return join_data

    def retrieve_tables(self, tables: List[Any]) -> List[Table]:
        if not self._clean_query:
            return []
        return [
            self.clean_table_name(table)
            for table in tables
            if isinstance(table, (Table, DataFunction))
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

        clean_query = clean_query.replace("\\n", "\n")

        if insensitive_match(
            clean_query, r"\s*/\*.*?\*/\s*merge.*into.*?when matched.*?"
        ):
            clean_query = insensitive_replace(
                raw_str=clean_query,
                to_replace="when matched.*",  # merge into queries specific
                replace_by="",  # remove it as LineageRunner is not able to perform the lineage
            )

        # We remove queries of the type 'COPY table FROM path' since they are data manipulation statement and do not
        # provide value for user
        if insensitive_match(clean_query, "^COPY.*"):
            return None

        return clean_query.strip()

    def _evaluate_best_parser(
        self, query: str, dialect: Dialect, timeout_seconds: int
    ) -> Optional[LineageRunner]:
        if query is None:
            return None

        @timeout(seconds=timeout_seconds)
        def get_sqlfluff_lineage_runner(qry: str, dlct: str) -> LineageRunner:
            lr_dialect = LineageRunner(qry, dialect=dlct)
            lr_dialect.get_column_lineage()
            return lr_dialect

        try:
            lr_sqlfluff = get_sqlfluff_lineage_runner(query, dialect.value)
            _ = len(lr_sqlfluff.get_column_lineage()) + len(
                set(lr_sqlfluff.source_tables).union(
                    set(lr_sqlfluff.target_tables).union(
                        set(lr_sqlfluff.intermediate_tables)
                    )
                )
            )
        except TimeoutError:
            self.query_parsing_success = False
            self.query_parsing_failure_reason = (
                f"Lineage with SqlFluff failed for the [{dialect.value}]. "
                f"Parser has been running for more than {timeout_seconds} seconds."
            )
            lr_sqlfluff = None
        except Exception:
            self.query_parsing_success = False
            self.query_parsing_failure_reason = (
                f"Lineage with SqlFluff failed for the [{dialect.value}]"
            )
            lr_sqlfluff = None

        if lr_sqlfluff:
            return lr_sqlfluff

        @timeout(seconds=timeout_seconds)
        def get_sqlparser_lineage_runner(qry: str) -> LineageRunner:
            lr_sqlparser = LineageRunner(qry)
            lr_sqlparser.get_column_lineage()
            return lr_sqlparser

        lr_sqlparser = None
        try:
            lr_sqlparser = get_sqlparser_lineage_runner(query)
            _ = len(lr_sqlparser.get_column_lineage()) + len(
                set(lr_sqlparser.source_tables).union(
                    set(lr_sqlparser.target_tables).union(
                        set(lr_sqlparser.intermediate_tables)
                    )
                )
            )
        except TimeoutError:
            self.query_parsing_success = False
            self.query_parsing_failure_reason = (
                f"Lineage with SqlParser failed for the [{dialect.value}]. "
                f"Parser has been running for more than {timeout_seconds} seconds."
            )
            return None
        except Exception:
            # if both runner have failed we return the usual one
            logger.debug(f"Failed to parse query with sqlparse & sqlfluff: {query}")
            return lr_sqlfluff if lr_sqlfluff else None

        self.masked_query = mask_query(self._clean_query, parser=lr_sqlparser)
        logger.debug(
            f"Using sqlparse for lineage parsing for query: {self.masked_query or self.query}"
        )
        return lr_sqlparser

    @staticmethod
    def clean_table_name(table: Table) -> Table:
        """
        Clean table name by:
        - Removing brackets from the beginning and end of the table and schema name

        Args:
            table (Table): table to be cleaned

        Returns:
            Copy of the table object with cleaned names
        """
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
