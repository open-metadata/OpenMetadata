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
Databricks Query parser module
"""
from abc import ABC
from typing import Optional

from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DatabricksQueryParserSource(QueryParserSource, ABC):
    """
    Databricks base for Usage and Lineage
    """

    filters: str

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: DatabricksConnection = config.serviceConnection.root.config
        if not isinstance(connection, DatabricksConnection):
            raise InvalidSourceException(
                f"Expected DatabricksConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_sql_statement(self, start_time, end_time):
        """
        returns sql statement to fetch query logs.

        Override if we have specific parameters
        """
        return self.sql_stmt.format(
            start_time=start_time,
            end_time=end_time,
            filters=self.get_filters(),
            result_limit=self.source_config.resultLimit,
            query_history=self.service_connection.queryHistoryTable,
        )
