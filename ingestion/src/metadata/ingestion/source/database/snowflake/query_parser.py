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
Snowflake Query parser module
"""
from abc import ABC
from datetime import datetime
from typing import Iterable

from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.ingestion.source.database.snowflake.queries import (
    SNOWFLAKE_SESSION_TAG_QUERY,
)
from metadata.utils.helpers import get_start_and_end
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()
SNOWFLAKE_ABORTED_CODE = "1969"


class SnowflakeQueryParserSource(QueryParserSource, ABC):
    """
    Snowflake base for Usage and Lineage
    """

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__(config, metadata_config)

        duration = self.source_config.queryLogDuration
        self.start, self.end = get_start_and_end(duration)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: SnowflakeConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, SnowflakeConnection):
            raise InvalidSourceException(
                f"Expected SnowflakeConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_sql_statement(self, start_time: datetime, end_time: datetime) -> str:
        """
        returns sql statement to fetch query logs
        """
        return self.sql_stmt.format(
            start_time=start_time,
            end_time=end_time,
            result_limit=self.config.sourceConfig.config.resultLimit,
            filters=self.filters,  # pylint: disable=no-member
        )

    def set_session_query_tag(self) -> None:
        """
        Method to set query tag for current session
        """
        if self.service_connection.queryTag:
            self.engine.execute(
                SNOWFLAKE_SESSION_TAG_QUERY.format(
                    query_tag=self.service_connection.queryTag
                )
            )

    def get_table_query(self) -> Iterable[TableQuery]:
        database = self.config.serviceConnection.__root__.config.database
        if database:
            use_db_query = f"USE DATABASE {database}"
            self.engine.execute(use_db_query)
            self.set_session_query_tag()
            yield from super().get_table_query()
        else:
            query = "SHOW DATABASES"
            results = self.engine.execute(query)
            for res in results:
                row = list(res)
                use_db_query = f"USE DATABASE {row[1]}"
                self.engine.execute(use_db_query)
                logger.info(f"Ingesting from database: {row[1]}")
                self.config.serviceConnection.__root__.config.database = row[1]
                self.engine = get_connection(self.service_connection)
                self.set_session_query_tag()
                yield from super().get_table_query()

    def get_database_name(self, data: dict) -> str:  # pylint: disable=arguments-differ
        """
        Method to get database name
        """
        if not data["database_name"] and self.service_connection.database:
            return self.service_connection.database
        return data["database_name"]
