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
Query parser implementation
"""

import datetime
import traceback
from collections import defaultdict
from logging.config import DictConfigurator
from typing import Dict, List, Optional, Tuple

from sqllineage.exceptions import SQLLineageException
from sqlparse.sql import Comparison, Identifier, Statement

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.ingestion.api.processor import Processor, ProcessorStatus
from metadata.ingestion.models.table_queries import (
    QueryParserData,
    TableColumn,
    TableColumnJoin,
    TableQuery,
)
from metadata.utils.helpers import find_in_list
from metadata.utils.logger import ingestion_logger

# Prevent sqllineage from modifying the logger config
# Disable the DictConfigurator.configure method while importing LineageRunner
configure = DictConfigurator.configure
DictConfigurator.configure = lambda _: None
from sqllineage.core import models
from sqllineage.runner import LineageRunner

# Reverting changes after import is done
DictConfigurator.configure = configure


def get_involved_tables_from_parser(parser: LineageRunner) -> List[models.Table]:
    """
    Use the LineageRunner parser and combine
    source and intermediate tables into
    a single set.

    :param parser: LineageRunner
    :return: List of involved tables
    """
    try:
        return list(set(parser.source_tables).union(set(parser.intermediate_tables)))
    except SQLLineageException:
        logger.debug(
            f"Cannot extract source table information from query: {parser._sql}"
        )


def get_clean_parser_table_list(tables: List[models.Table]) -> List[str]:
    """
    Clean the table name if it has <default>.
    :param tables: involved tables
    :return: clean table names
    """
    return [str(table).replace("<default>.", "") for table in tables]


def get_parser_table_aliases(tables: List[models.Table]) -> Dict[str, str]:
    """
    Prepare a dictionary in the shape of {alias: table_name} from
    the parser tables
    :param tables: parser tables
    :return: alias dict
    """
    return {table.alias: str(table).replace("<default>.", "") for table in tables}


def get_table_name_from_list(
    database_name: Optional[str],
    schema_name: Optional[str],
    table_name: str,
    tables: List[str],
) -> Optional[str]:
    """
    Find the table name (in any format in my come)
    from the list using the given ingredients.

    :param database_name: db name
    :param schema_name: schema name
    :param table_name: table name
    :param tables: Contains all involved tables
    :return: table name from parser info
    """
    table = find_in_list(element=table_name, container=tables)
    if table:
        return table

    schema_table = find_in_list(element=f"{schema_name}.{table_name}", container=tables)
    if schema_table:
        return schema_table

    db_schema_table = find_in_list(
        element=f"{database_name}.{schema_name}.{table_name}", container=tables
    )
    if db_schema_table:
        return db_schema_table

    logger.debug(f"Cannot find table {db_schema_table} in involved tables")
    return None


def get_comparison_elements(
    identifier: Identifier, tables: List[str], aliases: Dict[str, str]
) -> Optional[Tuple[str, str]]:
    """
    Return the tuple table_name, column_name from each comparison element
    :param identifier: comparison identifier
    :param tables: involved tables
    :param aliases: table aliases
    :return: table name and column name from the identifier
    """
    values = identifier.value.split(".")
    database_name, schema_name, table_or_alias, column_name = (
        [None] * (4 - len(values))
    ) + values

    if not table_or_alias or not column_name:
        logger.debug(f"Cannot obtain comparison elements from identifier {identifier}")
        return None

    alias_to_table = aliases.get(table_or_alias)
    if alias_to_table:
        return alias_to_table, column_name

    table_from_list = get_table_name_from_list(
        database_name=database_name,
        schema_name=schema_name,
        table_name=table_or_alias,
        tables=tables,
    )

    if not table_from_list:
        logger.debug(f"Cannot find {table_or_alias} in comparison elements")
        return None

    return table_from_list, column_name


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
            TableColumnJoin(table_column=source, joined_with=[target])
        )

    else:
        # check if new column from same table
        table_columns = [
            join_info.table_column for join_info in statement_joins[source.table]
        ]
        existing_table_column = find_in_list(element=source, container=table_columns)
        if existing_table_column:
            existing_join_info = [
                join_info
                for join_info in statement_joins[source.table]
                if join_info.table_column == existing_table_column
            ][0]
            existing_join_info.joined_with.append(target)
        # processing now join column from source table
        else:
            statement_joins[source.table].append(
                TableColumnJoin(table_column=source, joined_with=[target])
            )


def stateful_add_joins_from_statement(
    join_data: Dict[str, List[TableColumnJoin]],
    statement: Statement,
    tables: List[str],
    aliases: Dict[str, str],
) -> None:
    """
    Parse a single statement to pick up join information
    :param join_data: join data from previous statements
    :param statement: Parsed sql statement to process
    :param tables: involved tables in the query
    :param aliases: table aliases dict
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

        table_left, column_left = get_comparison_elements(
            identifier=comparison.left, tables=tables, aliases=aliases
        )
        table_right, column_right = get_comparison_elements(
            identifier=comparison.right, tables=tables, aliases=aliases
        )

        if not table_left or not table_right:
            logger.error(f"Cannot find ingredients from {comparison}")
            continue

        left_table_column = TableColumn(table=table_left, column=column_left)
        right_table_column = TableColumn(table=table_right, column=column_right)

        stateful_add_table_joins(join_data, left_table_column, right_table_column)
        stateful_add_table_joins(join_data, right_table_column, left_table_column)


def get_table_joins(
    parser: LineageRunner, tables: List[str], aliases: Dict[str, str]
) -> Dict[str, List[TableColumnJoin]]:
    """
    For each table involved in the query, find its joins against any
    other table.

    :param parser: LineageRunner parser
    :param tables: involved tables in the query
    :param aliases: table aliases dict
    :return: for each table name, list all joins against other tables
    """
    join_data = defaultdict(list)
    for statement in parser.statements_parsed:
        stateful_add_joins_from_statement(
            join_data, statement=statement, tables=tables, aliases=aliases
        )

    return join_data


def parse_sql_statement(record: TableQuery) -> Optional[QueryParserData]:
    """
    Use the lineage parser and work with the tokens
    to convert a RAW SQL statement into
    QueryParserData.
    :param record: TableQuery from usage
    :return: QueryParserData
    """

    start_date = record.analysis_date
    if isinstance(record.analysis_date, str):
        start_date = datetime.datetime.strptime(
            str(record.analysis_date), "%Y-%m-%d %H:%M:%S"
        ).date()

    parser = LineageRunner(record.sql)

    tables = get_involved_tables_from_parser(parser)

    if not tables:
        return None

    clean_tables = get_clean_parser_table_list(tables)
    aliases = get_parser_table_aliases(tables)

    return QueryParserData(
        tables=clean_tables,
        joins=get_table_joins(parser=parser, tables=clean_tables, aliases=aliases),
        database=record.database,
        schema_name=record.schema_name,
        sql=record.sql,
        date=start_date.strftime("%Y-%m-%d"),
        service_name=record.service_name,
    )


class QueryParserProcessorConfig(ConfigModel):
    """
    Query parser pydantic configuration model
    """

    filter: Optional[str] = None


logger = ingestion_logger()


class QueryParserProcessor(Processor):
    """
    Extension of the `Processor` class

    Args:
        config (QueryParserProcessorConfig):
        metadata_config (MetadataServerConfig):

    Attributes:
        config (QueryParserProcessorConfig):
        metadata_config (MetadataServerConfig):
        status (ProcessorStatus):
    """

    config: QueryParserProcessorConfig
    status: ProcessorStatus

    def __init__(
        self,
        config: QueryParserProcessorConfig,
        metadata_config: OpenMetadataConnection,
    ):

        self.config = config
        self.metadata_config = metadata_config
        self.status = ProcessorStatus()

    @classmethod
    def create(
        cls, config_dict: dict, metadata_config: OpenMetadataConnection, **kwargs
    ):
        config = QueryParserProcessorConfig.parse_obj(config_dict)
        return cls(config, metadata_config)

    def process(self, record: TableQuery) -> QueryParserData:
        try:
            query_parser_data = parse_sql_statement(record)
        except Exception as err:  # pylint: disable=broad-except
            if hasattr(record, "sql"):
                logger.debug(record.sql)
            logger.debug(traceback.format_exc())
            logger.error(err)
            query_parser_data = None

        return query_parser_data

    def close(self):
        pass

    def get_status(self) -> ProcessorStatus:
        return self.status
