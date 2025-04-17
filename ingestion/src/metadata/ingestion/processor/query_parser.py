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
Query parser implementation
"""

import datetime
import traceback
from typing import Optional

from metadata.config.common import ConfigModel
from metadata.generated.schema.type.basic import DateTime
from metadata.generated.schema.type.queryParserData import ParsedData, QueryParserData
from metadata.generated.schema.type.tableQuery import TableQueries, TableQuery
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import Processor
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper, Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import ingestion_logger
from metadata.utils.time_utils import datetime_to_timestamp

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
        start_date = start_time.root.date()
        start_time = datetime.datetime.strptime(str(start_date.isoformat()), "%Y-%m-%d")

    start_time = datetime_to_timestamp(start_time, milliseconds=True)

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
        dialect=dialect.value,
        userName=record.userName,
        date=str(start_time),
        serviceName=record.serviceName,
        duration=record.duration,
        cost=record.cost,
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

    @property
    def name(self) -> str:
        return "Query Parser"

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
        **kwargs,
    ):
        config = ConfigModel.model_validate(config_dict)
        connection_type = kwargs.pop("connection_type", "")
        return cls(config, metadata, connection_type)

    def _run(self, record: TableQueries) -> Optional[Either[QueryParserData]]:
        if record is None or record.queries is None:
            return None

        data = []
        success_cnt = 0
        failed_cnt = 0
        total_cnt = len(record.queries)

        for table_query in record.queries:
            try:
                parsed_sql = parse_sql_statement(
                    table_query,
                    ConnectionTypeDialectMapper.dialect_of(self.connection_type),
                )
                if parsed_sql:
                    data.append(parsed_sql)
                success_cnt += 1
            except Exception as exc:
                failed_cnt += 1
                logger.debug(traceback.format_exc())
                logger.warning(f"Error processing query [{table_query.query}]: {exc}")
            cur_total_cnt = success_cnt + failed_cnt
            if cur_total_cnt % 1000 == 0 or cur_total_cnt == total_cnt:
                logger.info(
                    f"Total query count:{cur_total_cnt} / {total_cnt}."
                    f" Current success count: {success_cnt}."
                    f" Current failed count: {failed_cnt}."
                )
        return Either(right=QueryParserData(parsedData=data))

    def close(self):
        """Nothing to close"""
