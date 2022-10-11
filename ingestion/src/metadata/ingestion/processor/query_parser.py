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
from logging.config import DictConfigurator
from typing import Optional

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.type.queryParserData import ParsedData, QueryParserData
from metadata.generated.schema.type.tableQuery import TableQueries, TableQuery
from metadata.ingestion.api.processor import Processor, ProcessorStatus
from metadata.ingestion.lineage.parser import (
    get_clean_parser_table_list,
    get_involved_tables_from_parser,
    get_parser_table_aliases,
    get_table_joins,
)
from metadata.utils.logger import ingestion_logger

configure = DictConfigurator.configure
DictConfigurator.configure = lambda _: None
from sqllineage.runner import LineageRunner  # pylint: disable=wrong-import-position

# Reverting changes after import is done
DictConfigurator.configure = configure

logger = ingestion_logger()


def parse_sql_statement(record: TableQuery) -> Optional[ParsedData]:
    """
    Use the lineage parser and work with the tokens
    to convert a RAW SQL statement into
    QueryParserData.
    :param record: TableQuery from usage
    :return: QueryParserData
    """

    start_date = record.analysisDate
    if isinstance(record.analysisDate, str):
        start_date = datetime.datetime.strptime(
            str(record.analysisDate), "%Y-%m-%d %H:%M:%S"
        ).date()

    parser = LineageRunner(record.query)

    tables = get_involved_tables_from_parser(parser)

    if not tables:
        return None

    clean_tables = get_clean_parser_table_list(tables)
    aliases = get_parser_table_aliases(tables)

    return ParsedData(
        tables=clean_tables,
        joins=get_table_joins(parser=parser, tables=clean_tables, aliases=aliases),
        databaseName=record.databaseName,
        databaseSchema=record.databaseSchema,
        sql=record.query,
        date=start_date.__root__.strftime("%Y-%m-%d"),
        serviceName=record.serviceName,
    )


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

    config: ConfigModel
    status: ProcessorStatus

    def __init__(
        self,
        config: ConfigModel,
        metadata_config: OpenMetadataConnection,
    ):

        self.config = config
        self.metadata_config = metadata_config
        self.status = ProcessorStatus()

    @classmethod
    def create(
        cls, config_dict: dict, metadata_config: OpenMetadataConnection, **kwargs
    ):
        config = ConfigModel.parse_obj(config_dict)
        return cls(config, metadata_config)

    def process(  # pylint: disable=arguments-differ
        self, queries: TableQueries
    ) -> Optional[QueryParserData]:
        if queries and queries.queries:
            data = []
            for record in queries.queries:
                try:
                    parsed_sql = parse_sql_statement(record)
                    if parsed_sql:
                        data.append(parsed_sql)
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(f"Error processing query [{record.query}]: {exc}")
            return QueryParserData(parsedData=data)

        return None

    def close(self):
        pass

    def get_status(self) -> ProcessorStatus:
        return self.status
