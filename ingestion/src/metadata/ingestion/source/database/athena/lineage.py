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
Athena lineage module
"""
from typing import Iterable, Optional

from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.source.database.athena.query_parser import (
    QUERY_SUCCESS_STATUS,
    AthenaQueryParserSource,
)
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class AthenaLineageSource(AthenaQueryParserSource, LineageSource):
    """
    Athena Lineage Source
    """

    def yield_table_query(self) -> Optional[Iterable[TableQuery]]:
        """
        Method to yield TableQueries
        """
        for query_list in self.get_queries() or []:
            for query in query_list.QueryExecutions:
                if (
                    query.Status.SubmissionDateTime.date() >= self.start.date()
                    and self.is_not_dbt_or_om_query(query.Query)
                    and query.Status.State.upper() == QUERY_SUCCESS_STATUS
                ):
                    yield TableQuery(
                        dialect=self.dialect.value,
                        query=query.Query,
                        serviceName=self.config.serviceName,
                    )
