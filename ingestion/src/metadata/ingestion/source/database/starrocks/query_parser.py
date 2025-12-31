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
StarRocks query parser module
"""
from abc import ABC
from datetime import datetime
from typing import Optional

from metadata.generated.schema.entity.services.connections.database.starrocksConnection import (
    StarRocksConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.ingestion.source.database.starrocks.queries import STARROCKS_SQL_STATEMENT


class StarRocksQueryParserSource(QueryParserSource, ABC):
    """
    StarRocks base for Usage and Lineage
    """

    filters: str

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: StarRocksConnection = config.serviceConnection.root.config
        if not isinstance(connection, StarRocksConnection):
            raise InvalidSourceException(
                f"Expected StarRocksConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_sql_statement(self, start_time: datetime, end_time: datetime) -> str:
        """
        Returns SQL statement to fetch query logs from StarRocks audit log.
        """
        return STARROCKS_SQL_STATEMENT.format(
            start_time=start_time,
            end_time=end_time,
            filters=self.get_filters(),
            result_limit=self.source_config.resultLimit,
        )

    def get_filters(self) -> str:
        if self.source_config.filterCondition:
            return f"{self.filters} AND {self.source_config.filterCondition}"
        return self.filters
