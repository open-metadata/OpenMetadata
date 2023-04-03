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
Athena usage module
"""
from datetime import datetime
from typing import Iterable, Optional

from metadata.generated.schema.type.tableQuery import TableQueries, TableQuery
from metadata.ingestion.source.database.athena.query_parser import (
    AthenaQueryParserSource,
)
from metadata.ingestion.source.database.usage_source import UsageSource
from metadata.utils.constants import DATETIME_STR_FORMAT
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

QUERY_ABORTED_STATE = "CANCELLED"


class AthenaUsageSource(AthenaQueryParserSource, UsageSource):
    """
    Athena Usage Source
    """

    def yield_table_queries(self) -> Optional[Iterable[TableQuery]]:
        """
        Method to yield TableQueries
        """
        for query_list in self.get_queries() or []:
            queries = [
                TableQuery(
                    query=query.Query,
                    startTime=datetime.strftime(
                        query.Status.SubmissionDateTime, DATETIME_STR_FORMAT
                    ),
                    endTime=datetime.strftime(
                        query.Status.SubmissionDateTime, DATETIME_STR_FORMAT
                    ),
                    analysisDate=query.Status.SubmissionDateTime,
                    serviceName=self.config.serviceName,
                    duration=query.Statistics.TotalExecutionTimeInMillis,
                    aborted=query.Status.State == QUERY_ABORTED_STATE,
                )
                for query in query_list.QueryExecutions
                if query.Status.SubmissionDateTime.date() >= self.start.date()
                and self.is_not_dbt_or_om_query(query.Query)
            ]
            yield TableQueries(queries=queries)
