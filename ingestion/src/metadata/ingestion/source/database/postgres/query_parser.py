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
Postgres Query parser module
"""
import csv
import traceback
from abc import ABC
from datetime import datetime
from typing import Iterable, Optional

from sqlalchemy.engine.base import Engine

from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.tableQuery import TableQueries, TableQuery
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.utils.helpers import get_start_and_end
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class PostgresQueryParserSource(QueryParserSource, ABC):
    """
    Postgres base for Usage and Lineage
    """

    filters: str

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__(config, metadata_config)

        # Postgres does not allow retrieval of data older than 7 days
        # Update start and end based on this
        duration = min(self.source_config.queryLogDuration, 6)
        self.start, self.end = get_start_and_end(duration)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: PostgresConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, PostgresConnection):
            raise InvalidSourceException(
                f"Expected PostgresConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_sql_statement(self, *_) -> str:
        """
        returns sql statement to fetch query logs.
        We don't use any start or end times as they are not available
        """
        return self.sql_stmt.format(
            result_limit=self.config.sourceConfig.config.resultLimit,
            filters=self.filters,  # pylint: disable=no-member
        )

    def get_table_query(self) -> Iterable[TableQuery]:

        try:
            if self.config.sourceConfig.config.queryLogFilePath:
                table_query_list = []
                with open(
                    self.config.sourceConfig.config.queryLogFilePath,
                    "r",
                    encoding="utf-8",
                ) as query_log_file:

                    for record in csv.DictReader(query_log_file):
                        query_dict = dict(record)

                        analysis_date = (
                            datetime.utcnow()
                            if not query_dict.get("session_start_time")
                            else datetime.strptime(
                                query_dict.get("session_start_time"),
                                "%Y-%m-%d %H:%M:%S+%f",
                            )
                        )

                        query_dict["aborted"] = query_dict["sql_state_code"] == "00000"
                        if "statement" in query_dict["message"]:
                            query_dict["message"] = query_dict["message"].split(":")[1]

                        table_query_list.append(
                            TableQuery(
                                query=query_dict["message"],
                                userName=query_dict.get("user_name", ""),
                                startTime=query_dict.get("session_start_time", ""),
                                endTime=query_dict.get("log_time", ""),
                                analysisDate=analysis_date,
                                aborted=self.get_aborted_status(query_dict),
                                databaseName=self.get_database_name(query_dict),
                                serviceName=self.config.serviceName,
                                databaseSchema=self.get_schema_name(query_dict),
                            )
                        )
                yield TableQueries(queries=table_query_list)

            else:
                database = self.config.serviceConnection.__root__.config.database
                if database:
                    self.engine: Engine = get_connection(self.service_connection)
                    yield from self.process_table_query()
                else:
                    query = "select datname from pg_catalog.pg_database"
                    results = self.engine.execute(query)
                    for res in results:
                        row = list(res)
                        logger.info(f"Ingesting from database: {row[0]}")
                        self.config.serviceConnection.__root__.config.database = row[0]
                        self.engine = get_connection(self.service_connection)
                        yield from self.process_table_query()

        except Exception as err:
            logger.error(f"Source usage processing error - {err}")
            logger.debug(traceback.format_exc())

    def process_table_query(self) -> Optional[Iterable[TableQuery]]:
        """
        Process Query
        """
        try:
            with get_connection(self.service_connection).connect() as conn:
                rows = conn.execute(self.get_sql_statement())
                queries = []
                for row in rows:
                    row = dict(row)
                    try:
                        queries.append(
                            TableQuery(
                                query=row["query_text"],
                                userName=row["usename"],
                                analysisDate=datetime.now(),
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
            yield TableQueries(queries=queries)
        except Exception as err:
            logger.error(f"Source usage processing error - {err}")
            logger.debug(traceback.format_exc())

    @staticmethod
    def get_database_name(data: dict) -> str:
        """
        Method to get database name
        """
        return data.get("database_name")
