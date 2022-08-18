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
Postgres usage module
"""
import csv
import traceback
from abc import ABC
from datetime import datetime
from typing import Iterable, Optional

from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.tableQuery import TableQueries, TableQuery
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class PostgresQueryParserSource(QueryParserSource, ABC):
    """
    Postgres base for Usage and Lineage
    """

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: PostgresConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, PostgresConnection):
            raise InvalidSourceException(
                f"Expected PostgresConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_table_query(self) -> Optional[Iterable[TableQuery]]:
        """
        If queryLogFilePath available in config iterate through log file
        otherwise execute the sql query to fetch TableQuery data
        """
        try:
            if self.config.sourceConfig.config.queryLogFilePath:
                table_query_list = []
                with open(
                    self.config.sourceConfig.config.queryLogFilePath, "r"
                ) as query_log_file:

                    for i in csv.DictReader(query_log_file):
                        query_dict = dict(i)

                        analysis_date = (
                            datetime.utcnow()
                            if not query_dict.get("session_start_time")
                            else datetime.strptime(
                                query_dict.get("session_start_time"),
                                "%Y-%m-%d %H:%M:%S+%f",
                            )
                        )

                        query_dict["aborted"] = query_dict["sql_state_code"] == "00000"
                        if "statement" in query_dict["message"]:
                            query_dict["message"] = query_dict["message"].split(":")[1]

                        table_query_list.append(
                            TableQuery(
                                query=query_dict["message"],
                                userName=query_dict.get("user_name", ""),
                                startTime=query_dict.get("session_start_time", ""),
                                endTime=query_dict.get("log_time", ""),
                                analysisDate=analysis_date,
                                aborted=self.get_aborted_status(query_dict),
                                databaseName=self.get_database_name(query_dict),
                                serviceName=self.config.serviceName,
                                databaseSchema=self.get_schema_name(query_dict),
                            )
                        )
                yield TableQueries(queries=table_query_list)
        except Exception as err:
            logger.error(f"Source usage processing error - {err}")
            logger.debug(traceback.format_exc())

    def next_record(self) -> Iterable[TableQuery]:
        for table_queries in self.get_table_query():
            if table_queries:
                yield table_queries
