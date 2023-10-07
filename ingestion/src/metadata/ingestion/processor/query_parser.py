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
from typing import Optional

from metadata.config.common import ConfigModel
from metadata.generated.schema.type.basic import DateTime
from metadata.generated.schema.type.queryParserData import ParsedData, QueryParserData
from metadata.generated.schema.type.tableQuery import TableQueries, TableQuery
from metadata.ingestion.api.models import Either, StackTraceError
from metadata.ingestion.api.steps import Processor
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper, Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import ingestion_logger
from metadata.utils.time_utils import convert_timestamp_to_milliseconds

logger = ingestion_logger()


def parse_sql_statement(record: TableQuery, dialect: Dialect) -> Optional[ParsedData]:
    """
    Use the lineage parser and work with the tokens
    to convert a RAW SQL statement into
    QueryParserData.
    :param record: TableQuery from usage
    :param dialect: dialect used to compute lineage
    :return: QueryParserData
    """

    start_time = record.analysisDate
    if isinstance(start_time, DateTime):
        start_date = start_time.__root__.date()
        start_time = datetime.datetime.strptime(str(start_date.isoformat()), "%Y-%m-%d")

    start_time = convert_timestamp_to_milliseconds(int(start_time.timestamp()))

    lineage_parser = LineageParser(record.query, dialect=dialect)

    if not lineage_parser.involved_tables:
        return None

    return ParsedData(
        tables=lineage_parser.clean_table_list,
        joins=lineage_parser.table_joins,
        databaseName=record.databaseName,
        databaseSchema=record.databaseSchema,
        sql=record.query,
        query_type=record.query_type,
        exclude_usage=record.exclude_usage,
        userName=record.userName,
        date=start_time,
        serviceName=record.serviceName,
        duration=record.duration,
    )


class QueryParserProcessor(Processor):
    """Extension of the `Processor` class"""

    config: ConfigModel

    def __init__(
        self,
        config: ConfigModel,
        metadata: OpenMetadata,
        connection_type: str,
    ):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.connection_type = connection_type

    @classmethod
    def create(cls, config_dict: dict, metadata: OpenMetadata, **kwargs):
        config = ConfigModel.parse_obj(config_dict)
        connection_type = kwargs.pop("connection_type", "")
        return cls(config, metadata, connection_type)

    def _run(self, record: TableQueries) -> Optional[Either[QueryParserData]]:
        if record and record.queries:
            data = []
            for table_query in record.queries:
                try:
                    parsed_sql = parse_sql_statement(
                        table_query,
                        ConnectionTypeDialectMapper.dialect_of(self.connection_type),
                    )
                    if parsed_sql:
                        data.append(parsed_sql)
                except Exception as exc:
                    return Either(
                        left=StackTraceError(
                            name="Query",
                            error=f"Error processing query [{table_query.query}]: {exc}",
                            stack_trace=traceback.format_exc(),
                        )
                    )

            return Either(right=QueryParserData(parsedData=data))

        return None

    def close(self):
        """Nothing to close"""
