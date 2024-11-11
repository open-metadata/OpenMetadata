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
Usage Source Module
"""
import csv
import os
import traceback
from abc import ABC
from datetime import datetime, timedelta, timezone
from typing import Iterable

from metadata.generated.schema.type.basic import DateTime
from metadata.generated.schema.type.tableQuery import TableQueries, TableQuery
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.masker import mask_query
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class UsageSource(QueryParserSource, ABC):
    """
    Base class for all usage ingestion.

    Parse a query log to extract a `TableQuery` object
    """

    def yield_table_queries_from_logs(self) -> Iterable[TableQuery]:
        """
        Method to handle the usage from query logs
        """
        try:
            query_log_path = self.config.sourceConfig.config.queryLogFilePath
            if os.path.isfile(query_log_path):
                file_paths = [query_log_path]
            elif os.path.isdir(query_log_path):
                file_paths = [
                    os.path.join(query_log_path, f)
                    for f in os.listdir(query_log_path)
                    if f.endswith(".csv")
                ]
            else:
                raise ValueError(f"{query_log_path} is neither a file nor a directory.")
            for file_path in file_paths:
                query_list = []
                with open(file_path, "r", encoding="utf-8") as fin:
                    for record in csv.DictReader(fin):
                        query_dict = dict(record)

                        analysis_date = (
                            datetime.now(timezone.utc)
                            if not query_dict.get("start_time")
                            else datetime.strptime(
                                query_dict.get("start_time"), "%Y-%m-%d %H:%M:%S.%f"
                            )
                        )
                        query_list.append(
                            TableQuery(
                                dialect=self.dialect.value,
                                query=query_dict["query_text"],
                                userName=query_dict.get("user_name", ""),
                                startTime=query_dict.get("start_time", ""),
                                endTime=query_dict.get("end_time", ""),
                                duration=query_dict.get("duration"),
                                analysisDate=DateTime(analysis_date),
                                aborted=self.get_aborted_status(query_dict),
                                databaseName=self.get_database_name(query_dict),
                                serviceName=self.config.serviceName,
                                databaseSchema=self.get_schema_name(query_dict),
                            )
                        )
                yield TableQueries(queries=query_list)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to read queries form log file due to: {err}")

    def get_table_query(self) -> Iterable[TableQuery]:
        """
        If queryLogFilePath available in config iterate through log file
        otherwise execute the sql query to fetch TableQuery data
        """
        if self.config.sourceConfig.config.queryLogFilePath:
            yield from self.yield_table_queries_from_logs()
        else:
            yield from self.yield_table_queries()

    def format_query(self, query: str) -> str:
        return query.replace("\\n", "\n")

    def yield_table_queries(self) -> Iterable[TableQuery]:
        """
        Given an Engine, iterate over the day range and
        query the results
        """
        daydiff = self.end - self.start
        for days in range(daydiff.days):
            logger.info(
                f"Scanning query logs for {(self.start + timedelta(days=days)).date()} - "
                f"{(self.start + timedelta(days=days + 1)).date()}"
            )
            query = None
            try:
                query = self.get_sql_statement(
                    start_time=self.start + timedelta(days=days),
                    end_time=self.start + timedelta(days=days + 1),
                )
                for engine in self.get_engine():
                    with engine.connect() as conn:
                        rows = conn.execute(query)
                        queries = []
                        for row in rows:
                            row = dict(row)
                            try:
                                logger.debug(f"Processing row: {query}")
                                query_type = row.get("query_type")
                                query = self.format_query(row["query_text"])
                                queries.append(
                                    TableQuery(
                                        query=query,
                                        query_type=query_type,
                                        exclude_usage=self.check_life_cycle_query(
                                            query_type=query_type, query_text=query
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
                                    )
                                )
                            except Exception as exc:
                                logger.debug(traceback.format_exc())
                                logger.warning(
                                    f"Unexpected exception processing row [{row}]: {exc}"
                                )
                    yield TableQueries(queries=queries)
            except Exception as exc:
                if query:
                    logger.debug(
                        f"###### USAGE QUERY #######\n{mask_query(query, self.dialect.value)}\n##########################"
                    )
                logger.debug(traceback.format_exc())
                logger.error(f"Source usage processing error: {exc}")

    def _iter(self, *_, **__) -> Iterable[Either[TableQuery]]:
        for table_queries in self.get_table_query():
            if table_queries:
                yield Either(right=table_queries)
