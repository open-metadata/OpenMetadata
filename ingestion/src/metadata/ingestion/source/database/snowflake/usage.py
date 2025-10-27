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
Snowflake usage module
"""
import traceback
from datetime import timedelta
from typing import Iterable

from metadata.generated.schema.type.basic import DateTime
from metadata.generated.schema.type.tableQuery import TableQueries, TableQuery
from metadata.ingestion.lineage.masker import mask_query
from metadata.ingestion.source.database.snowflake.queries import SNOWFLAKE_SQL_STATEMENT
from metadata.ingestion.source.database.snowflake.query_parser import (
    SNOWFLAKE_QUERY_BATCH_SIZE,
    SnowflakeQueryParserSource,
)
from metadata.ingestion.source.database.usage_source import UsageSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SnowflakeUsageSource(SnowflakeQueryParserSource, UsageSource):
    """
    Snowflake class for Usage
    """

    sql_stmt = SNOWFLAKE_SQL_STATEMENT

    filters = """
        AND QUERY_TYPE NOT IN ('ROLLBACK','CREATE_USER','CREATE_ROLE','CREATE_NETWORK_POLICY',
        'ALTER_ROLE','ALTER_NETWORK_POLICY','ALTER_ACCOUNT','DROP_SEQUENCE','DROP_USER',
        'DROP_ROLE','DROP_NETWORK_POLICY','REVOKE','UNLOAD','USE','ALTER_SESSION',
        'COPY','COMMIT','CREATE_TABLE','PUT_FILES','GET_FILES', 'CREATE_TABLE_AS_SELECT','SHOW', 'DESCRIBE')
    """

    life_cycle_filters = [
        "DROP",
        "DELETE",
        "TRUNCATE_TABLE",
        "UPDATE",
        "ALTER",
        "INSERT",
        "MERGE",
    ]

    def yield_table_queries(self) -> Iterable[TableQuery]:
        """
        Given an Engine, iterate over the day range and
        query the results with pagination
        """
        daydiff = self.end - self.start
        for days in range(daydiff.days):
            logger.info(
                f"Scanning query logs for {(self.start + timedelta(days=days)).date()} - "
                f"{(self.start + timedelta(days=days + 1)).date()}"
            )
            query = None
            offset = 0
            total_fetched = 0
            max_results = self.source_config.resultLimit
            try:
                for engine in self.get_engine():
                    while total_fetched < max_results:
                        batch_size = min(
                            SNOWFLAKE_QUERY_BATCH_SIZE, max_results - total_fetched
                        )
                        query = self.get_sql_statement(
                            start_time=self.start + timedelta(days=days),
                            end_time=self.start + timedelta(days=days + 1),
                            offset=offset,
                            limit=batch_size,
                        )
                        with engine.connect() as conn:
                            rows = conn.execute(query)
                            queries = []
                            row_count = 0
                            for row in rows:
                                row = dict(row)
                                row_count += 1
                                try:
                                    row.update({k.lower(): v for k, v in row.items()})
                                    logger.debug(f"Processing row: {row}")
                                    query_type = row.get("query_type")
                                    query_text = self.format_query(row["query_text"])
                                    queries.append(
                                        TableQuery(
                                            query=query_text,
                                            query_type=query_type,
                                            exclude_usage=self.check_life_cycle_query(
                                                query_type=query_type,
                                                query_text=query_text,
                                            ),
                                            dialect=self.dialect.value,
                                            userName=row["user_name"],
                                            startTime=str(row["start_time"]),
                                            endTime=str(row["end_time"]),
                                            analysisDate=DateTime(row["start_time"]),
                                            aborted=self.get_aborted_status(row),
                                            databaseName=self.get_database_name(row),
                                            duration=row.get("duration"),
                                            serviceName=self.config.serviceName,
                                            databaseSchema=self.get_schema_name(row),
                                            cost=row.get("cost"),
                                        )
                                    )
                                except Exception as exc:
                                    logger.debug(traceback.format_exc())
                                    logger.warning(
                                        f"Unexpected exception processing row [{row}]: {exc}"
                                    )
                        if queries:
                            yield TableQueries(queries=queries)
                        total_fetched += row_count
                        if row_count < batch_size:
                            break
                        offset += batch_size
                        logger.info(
                            f"Fetching next page with offset {offset} (fetched {total_fetched}/{max_results}) "
                            f"for {(self.start + timedelta(days=days)).date()}"
                        )
            except Exception as exc:
                if query:
                    logger.debug(
                        (
                            f"###### USAGE QUERY #######\n{mask_query(query, self.dialect.value) or query}"
                            "\n##########################"
                        )
                    )
                logger.debug(traceback.format_exc())
                logger.error(f"Source usage processing error: {exc}")
