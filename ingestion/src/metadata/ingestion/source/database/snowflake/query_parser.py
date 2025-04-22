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
Snowflake Query parser module
"""
from abc import ABC
from datetime import datetime
from typing import Iterable, Optional

from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.ingestion.source.database.snowflake.queries import (
    SNOWFLAKE_SESSION_TAG_QUERY,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()
SNOWFLAKE_ABORTED_CODE = "1969"


class SnowflakeQueryParserSource(QueryParserSource, ABC):
    """
    Snowflake base for Usage and Lineage
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: SnowflakeConnection = config.serviceConnection.root.config
        if not isinstance(connection, SnowflakeConnection):
            raise InvalidSourceException(
                f"Expected SnowflakeConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_sql_statement(self, start_time: datetime, end_time: datetime) -> str:
        """
        returns sql statement to fetch query logs
        """
        return self.sql_stmt.format(
            start_time=start_time,
            end_time=end_time,
            result_limit=self.config.sourceConfig.config.resultLimit,
            filters=self.get_filters(),
            account_usage=self.service_connection.accountUsageSchema,
            credit_cost=self.service_connection.creditCost
            * self.service_connection.creditCost,
        )

    def check_life_cycle_query(
        self, query_type: Optional[str], query_text: Optional[str]
    ) -> bool:
        """
        returns true if query is to be used for life cycle processing.

        Override if we have specific parameters
        """
        if (
            query_type
            and query_type.upper()
            in self.life_cycle_filters  # pylint: disable=no-member
        ):
            return True
        return False

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
        self.set_session_query_tag()
        yield from super().get_table_query()

    def get_database_name(self, data: dict) -> str:  # pylint: disable=arguments-differ
        """
        Method to get database name
        """
        if not data["database_name"] and self.service_connection.database:
            return self.service_connection.database
        return data["database_name"]
