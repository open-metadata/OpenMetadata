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
Snowflake lineage module
"""

import traceback
from typing import Dict, Iterator, List

from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.snowflake.queries import (
    SNOWFLAKE_GET_STORED_PROCEDURE_QUERIES,
    SNOWFLAKE_SQL_STATEMENT,
)
from metadata.ingestion.source.database.snowflake.query_parser import (
    SnowflakeQueryParserSource,
)
from metadata.ingestion.source.database.stored_procedures_mixin import (
    QueryByProcedure,
    StoredProcedureLineageMixin,
)
from metadata.utils.helpers import get_start_and_end
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SnowflakeLineageSource(
    SnowflakeQueryParserSource, StoredProcedureLineageMixin, LineageSource
):
    """
    Snowflake class for Lineage
    """

    sql_stmt = SNOWFLAKE_SQL_STATEMENT

    filters = """
        AND (
            QUERY_TYPE IN ('MERGE', 'UPDATE','CREATE_TABLE_AS_SELECT')
            OR (QUERY_TYPE = 'INSERT' and query_text ILIKE '%%insert%%into%%select%%')
            OR (QUERY_TYPE = 'ALTER' and query_text ILIKE '%%alter%%table%%swap%%')
            OR (QUERY_TYPE = 'CREATE_TABLE' and query_text ILIKE '%%clone%%')
            OR (QUERY_TYPE = 'CREATE_VIEW' and query_text ILIKE '%%create%%temporary%%view%%')
        )
    """

    stored_procedure_query = SNOWFLAKE_GET_STORED_PROCEDURE_QUERIES

    def get_stored_procedure_queries_dict(self) -> Dict[str, List[QueryByProcedure]]:
        """
        Return the dictionary associating stored procedures to the
        queries they triggered
        """
        start, _ = get_start_and_end(self.source_config.queryLogDuration)
        query = self.stored_procedure_query.format(
            start_date=start,
            account_usage=self.service_connection.accountUsageSchema,
        )
        queries_dict = self.procedure_queries_dict(
            query=query,
        )

        return queries_dict

    def yield_table_query(self) -> Iterator[TableQuery]:
        """
        Given an engine, iterate over the query results to
        yield a TableQuery with query parsing info
        """
        for engine in self.get_engine():
            rows = []
            with engine.connect() as conn:
                rows = conn.execution_options(
                    stream_results=True, max_row_buffer=100
                ).execute(
                    self.get_sql_statement(start_time=self.start, end_time=self.end)
                )
            # exit from active connection after fetching rows & during
            # further process of `yield_query_lineage`
            for row in rows:
                query_dict = dict(row)
                query_dict.update({k.lower(): v for k, v in query_dict.items()})
                try:
                    yield TableQuery(
                        dialect=self.dialect.value,
                        query=query_dict["query_text"],
                        databaseName=self.get_database_name(query_dict),
                        serviceName=self.config.serviceName,
                        databaseSchema=self.get_schema_name(query_dict),
                    )
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(f"Error processing query_dict {query_dict}: {exc}")
