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
import traceback
from datetime import datetime
from typing import Iterable

from metadata.generated.schema.type.basic import DateTime
from metadata.generated.schema.type.tableQuery import TableQueries, TableQuery
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.database.postgres.queries import POSTGRES_SQL_STATEMENT
from metadata.ingestion.source.database.postgres.query_parser import (
    PostgresQueryParserSource,
)
from metadata.ingestion.source.database.usage_source import UsageSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class PostgresUsageSource(PostgresQueryParserSource, UsageSource):
    """
    Postgres class for Usage
    """

    sql_stmt = POSTGRES_SQL_STATEMENT
    filters = ""

    def process_table_query(self) -> Iterable[TableQueries]:
        """
        Process Query
        """
        query = None
        try:
            query = self.get_sql_statement()
            with get_connection(self.service_connection).connect() as conn:
                rows = conn.execute(query)
                queries = []
                for row in rows:
                    row = dict(row)
                    try:
                        queries.append(
                            TableQuery(
                                dialect=self.dialect.value,
                                query=row["query_text"],
                                userName=row["usename"],
                                analysisDate=DateTime(datetime.now()),
                                aborted=self.get_aborted_status(row),
                                databaseName=self.get_database_name(row),
                                serviceName=self.config.serviceName,
                                databaseSchema=self.get_schema_name(row),
                                duration=row.get("duration"),
                            )
                        )
                    except Exception as err:
                        logger.debug(traceback.format_exc())
                        logger.error(str(err))
            if queries:
                yield TableQueries(queries=queries)
        except Exception as err:
            if query:
                logger.debug(
                    f"###### USAGE QUERY #######\n{query}\n##########################"
                )
            logger.error(f"Source usage processing error - {err}")
            logger.debug(traceback.format_exc())

    def get_filters(self) -> str:
        if filter_condition := self.source_config.filterCondition:
            filter_condition = filter_condition.replace("%", "%%")
            return f"{self.filters} AND s.{filter_condition}"
        return self.filters
