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
Databricks lineage module
"""
import csv
import traceback
from datetime import datetime
from typing import Iterator, Optional

from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.source.database.databricks_query_parser import (
    DatabricksQueryParserSource,
)
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DatabricksLineageSource(DatabricksQueryParserSource, LineageSource):
    """
    Databricks Lineage Source
    """

    def get_table_query(self) -> Optional[Iterator[TableQuery]]:
        """
        If queryLogFilePath available in config iterate through log file
        otherwise execute the sql query to fetch TableQuery data.

        This is a simplified version of the UsageSource query parsing.
        """
        if self.config.sourceConfig.config.queryLogFilePath:

            with open(
                self.config.sourceConfig.config.queryLogFilePath, "r", encoding="utf-8"
            ) as file:
                for row in csv.DictReader(file):
                    query_dict = dict(row)
                    yield TableQuery(
                        query=query_dict["query_text"],
                        databaseName=self.get_database_name(query_dict),
                        serviceName=self.config.serviceName,
                        databaseSchema=self.get_schema_name(query_dict),
                    )

        else:
            logger.info(
                f"Scanning query logs for {self.start.date()} - {self.end.date()}"
            )
            try:
                data = self.client.list_query_history(
                    start_date=self.start,
                    end_date=self.end,
                )
                for row in data:
                    try:
                        if self.client.is_query_valid(row):
                            yield TableQuery(
                                query=row.get("query_text"),
                                userName=row.get("user_name"),
                                startTime=row.get("query_start_time_ms"),
                                endTime=row.get("execution_end_time_ms"),
                                analysisDate=datetime.now(),
                                serviceName=self.config.serviceName,
                            )
                    except Exception as exc:
                        logger.debug(traceback.format_exc())
                        logger.warning(f"Error processing query_dict {row}: {exc}")
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(f"Source usage processing error: {exc}")
