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
Athena usage module
"""
from typing import Iterable

from metadata.generated.schema.type.tableQuery import TableQueries, TableQuery
from metadata.ingestion.source.database.athena.query_parser import (
    QUERY_SUCCESS_STATUS,
    AthenaQueryParserSource,
)
from metadata.ingestion.source.database.usage_source import UsageSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

QUERY_ABORTED_STATE = "CANCELLED"
DATETIME_SEPARATOR = " "
DATETIME_TIME_SPEC = "seconds"


class AthenaUsageSource(AthenaQueryParserSource, UsageSource):
    """
    Athena Usage Source
    """

    def yield_table_queries(self) -> Iterable[TableQueries]:
        """
        Method to yield TableQueries
        """
        for query_list in self.get_queries() or []:
            queries = [
                TableQuery(
                    dialect=self.dialect.value,
                    query=query.Query,
                    startTime=query.Status.SubmissionDateTime.isoformat(
                        DATETIME_SEPARATOR, DATETIME_TIME_SPEC
                    ),
                    endTime=query.Status.SubmissionDateTime.isoformat(
                        DATETIME_SEPARATOR, DATETIME_TIME_SPEC
                    ),
                    analysisDate=query.Status.SubmissionDateTime,
                    serviceName=self.config.serviceName,
                    duration=query.Statistics.TotalExecutionTimeInMillis
                    if query.Statistics
                    else None,
                    aborted=query.Status.State == QUERY_ABORTED_STATE,
                )
                for query in query_list.QueryExecutions
                if query.Status
                and query.Query
                and query.Status.State.upper() == QUERY_SUCCESS_STATUS
                and query.Status.SubmissionDateTime.date() >= self.start.date()
                and self.is_not_dbt_or_om_query(query.Query)
            ]
            yield TableQueries(queries=queries)
