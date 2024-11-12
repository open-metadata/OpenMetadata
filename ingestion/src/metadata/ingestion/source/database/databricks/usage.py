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
import traceback
from datetime import datetime
from typing import Iterable

from metadata.generated.schema.type.basic import DateTime
from metadata.generated.schema.type.tableQuery import TableQueries, TableQuery
from metadata.ingestion.source.database.databricks.query_parser import (
    DatabricksQueryParserSource,
)
from metadata.ingestion.source.database.usage_source import UsageSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DatabricksUsageSource(DatabricksQueryParserSource, UsageSource):
    """
    Databricks Usage Source
    """

    def yield_table_queries(self) -> Iterable[TableQuery]:
        """
        Method to yield TableQueries
        """
        queries = []
        data = self.client.list_query_history(
            start_date=self.start,
            end_date=self.end,
        )
        for row in data or []:
            try:
                if self.client.is_query_valid(row):
                    queries.append(
                        TableQuery(
                            dialect=self.dialect.value,
                            query=row.get("query_text"),
                            userName=row.get("user_name"),
                            startTime=str(row.get("query_start_time_ms")),
                            endTime=str(row.get("execution_end_time_ms")),
                            analysisDate=DateTime(datetime.now()),
                            serviceName=self.config.serviceName,
                            duration=row.get("duration")
                            if row.get("duration")
                            else None,
                        )
                    )
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Failed to process query {row.get('query_text')} due to: {err}"
                )

        yield TableQueries(queries=queries)
