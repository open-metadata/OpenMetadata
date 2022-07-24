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
Usage Souce Module
"""
import csv
import traceback
from abc import ABC
from datetime import datetime, timedelta
from typing import Iterable, Optional

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)

# This import verifies that the dependencies are available.
from metadata.generated.schema.type.tableQuery import TableQueries, TableQuery
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.source.database.common_db_source import SQLSourceStatus
from metadata.utils.connections import get_connection, test_connection
from metadata.utils.filters import filter_by_database, filter_by_schema
from metadata.utils.helpers import get_start_and_end
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class UsageSource(Source[TableQuery], ABC):

    sql_stmt: str

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__()
        self.config = config
        self.metadata_config = metadata_config
        self.connection = config.serviceConnection.__root__.config
        self.source_config = self.config.sourceConfig.config
        self.start, self.end = get_start_and_end(self.source_config.queryLogDuration)
        self.analysis_date = self.end
        self.report = SQLSourceStatus()
        self.engine = get_connection(self.connection)

    def prepare(self):
        return super().prepare()

    def get_database_name(self, data: dict) -> str:
        """
        Method to get database name
        """
        return data.get("database_name")

    def get_schema_name(self, data: dict) -> str:
        """
        Method to get schema name
        """
        return data.get("schema_name")

    def get_aborted_status(self, data: dict) -> bool:
        """
        Method to get aborted status of query
        """
        return data.get("aborted", False)

    def get_sql_statement(self, start_time: datetime, end_time: datetime) -> str:
        """
        returns sql statement to fetch query logs
        """
        return self.sql_stmt.format(start_time=start_time, end_time=end_time)

    def _get_raw_extract_iter(self) -> Optional[Iterable[TableQuery]]:
        """
        If queryLogFilePath available in config iterate through log file
        otherwise execute the sql query to fetch TableQuery data
        """
        if self.config.sourceConfig.config.queryLogFilePath:
            query_list = []
            with open(self.config.sourceConfig.config.queryLogFilePath, "r") as fin:
                for i in csv.DictReader(fin):
                    query_dict = dict(i)
                    analysis_date = (
                        datetime.utcnow()
                        if not query_dict.get("start_time")
                        else datetime.strptime(
                            query_dict.get("start_time"), "%Y-%m-%d %H:%M:%S.%f"
                        )
                    )
                    query_list.append(
                        TableQuery(
                            query=query_dict["query_text"],
                            userName=query_dict.get("user_name", ""),
                            startTime=query_dict.get("start_time", ""),
                            endTime=query_dict.get("end_time", ""),
                            analysisDate=analysis_date,
                            aborted=self.get_aborted_status(query_dict),
                            databaseName=self.get_database_name(query_dict),
                            serviceName=self.config.serviceName,
                            databaseSchema=query_dict.get("schema_name"),
                        )
                    )
            yield TableQueries(queries=query_list)

        else:
            daydiff = self.end - self.start
            for i in range(daydiff.days):
                logger.info(
                    f"Scanning query logs for {(self.start+timedelta(days=i)).date()} - {(self.start+timedelta(days=i+1)).date()}"
                )
                try:
                    rows = self.engine.execute(
                        self.get_sql_statement(
                            start_time=self.start + timedelta(days=i),
                            end_time=self.start + timedelta(days=i + 1),
                        )
                    )
                    queries = []
                    for row in rows:
                        row = dict(row)
                        try:
                            if filter_by_database(
                                self.source_config.databaseFilterPattern,
                                self.get_database_name(row),
                            ) or filter_by_schema(
                                self.source_config.schemaFilterPattern,
                                schema_name=row["schema_name"],
                            ):
                                continue
                            queries.append(
                                TableQuery(
                                    query=row["query_text"],
                                    userName=row["user_name"],
                                    startTime=str(row["start_time"]),
                                    endTime=str(row["end_time"]),
                                    analysisDate=row["start_time"],
                                    aborted=self.get_aborted_status(row),
                                    databaseName=self.get_database_name(row),
                                    serviceName=self.config.serviceName,
                                    databaseSchema=self.get_schema_name(row),
                                )
                            )
                        except Exception as err:
                            logger.debug(traceback.format_exc())
                            logger.error(str(err))
                    yield TableQueries(queries=queries)
                except Exception as err:
                    logger.debug(traceback.format_exc())
                    logger.error(str(err))

    def next_record(self) -> Iterable[TableQuery]:
        """
        Using itertools.groupby and raw level iterator,
        it groups to table and yields TableMetadata
        :return:
        """
        for table_queries in self._get_raw_extract_iter():
            if table_queries:
                yield table_queries

    def get_report(self):
        """
        get report

        Returns:
        """
        return self.report

    def close(self):
        pass

    def get_status(self) -> SourceStatus:
        return self.report

    def test_connection(self) -> None:
        test_connection(self.engine)
