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
Databricks usage module
"""
import csv
import traceback
from datetime import datetime
from typing import Iterable, Optional

from metadata.generated.schema.type.tableQuery import TableQueries, TableQuery
from metadata.ingestion.source.database.databricks_query_parser import (
    DatabricksQueryParserSource,
)
from metadata.ingestion.source.database.usage_source import UsageSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DatabricksUsageSource(DatabricksQueryParserSource, UsageSource):
    """
    Databricks Usage Source
    """

    def get_table_query(self) -> Iterable[TableQuery]:

        try:
            if self.config.sourceConfig.config.queryLogFilePath:
                table_query_list = []
                with open(
                    self.config.sourceConfig.config.queryLogFilePath,
                    "r",
                    encoding="utf-8",
                ) as query_log_file:

                    for raw in csv.DictReader(query_log_file):
                        query_dict = dict(raw)

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

            else:

                yield from self.process_table_query()

        except Exception as err:
            logger.error(f"Source usage processing error - {err}")
            logger.debug(traceback.format_exc())

    def process_table_query(self) -> Optional[Iterable[TableQuery]]:
        """
        Method to yield TableQueries
        """
        try:
            queries = []
            data = self.client.list_query_history(
                start_date=self.start,
                end_date=self.end,
            )
            for row in data:
                try:
                    if self.client.is_query_valid(row):
                        queries.append(
                            TableQuery(
                                query=row.get("query_text"),
                                userName=row.get("user_name"),
                                startTime=row.get("query_start_time_ms"),
                                endTime=row.get("execution_end_time_ms"),
                                analysisDate=datetime.now(),
                                serviceName=self.config.serviceName,
                                databaseName="default",  # In databricks databaseName is always default
                            )
                        )
                except Exception as err:
                    logger.debug(traceback.format_exc())
                    logger.error(str(err))

            yield TableQueries(queries=queries)
        except Exception as err:
            logger.error(f"Source usage processing error - {err}")
            logger.debug(traceback.format_exc())
