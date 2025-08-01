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
Mysql query parser module
"""
from abc import ABC
from datetime import datetime
from typing import Optional

from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.mysql.queries import (
    MYSQL_SQL_STATEMENT,
    MYSQL_SQL_STATEMENT_SLOW_LOGS,
)
from metadata.ingestion.source.database.query_parser_source import QueryParserSource


class MysqlQueryParserSource(QueryParserSource, ABC):
    """
    Mysql base for Usage and Lineage
    """

    filters: str

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: MysqlConnection = config.serviceConnection.root.config
        if not isinstance(connection, MysqlConnection):
            raise InvalidSourceException(
                f"Expected MysqlConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_sql_statement(self, start_time: datetime, end_time: datetime) -> str:
        """
        returns sql statement to fetch query logs.

        Override if we have specific parameters
        """
        if self.service_connection.useSlowLogs:
            self.sql_stmt = MYSQL_SQL_STATEMENT_SLOW_LOGS
        else:
            self.sql_stmt = MYSQL_SQL_STATEMENT
        return self.sql_stmt.format(
            start_time=start_time,
            end_time=end_time,
            filters=self.get_filters(),
            result_limit=self.source_config.resultLimit,
        )

    def get_filters(self) -> str:
        if self.service_connection.useSlowLogs:
            sql_column = "sql_text"
        else:
            sql_column = "argument"
        if self.source_config.filterCondition:
            return f"{self.filters.format(sql_column=sql_column)} AND {self.source_config.filterCondition}"
        return self.filters.format(sql_column=sql_column)
