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
MSSQL usage module
"""

from abc import ABC
from typing import Optional

from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.mssql.queries import (
    MSSQL_SQL_STATEMENT_FROM_QUERY_STORE,
)
from metadata.ingestion.source.database.mssql.utils import is_query_store_enabled
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class MssqlQueryParserSource(QueryParserSource, ABC):
    """
    MSSQL base for Usage and Lineage
    """

    filters: str
    _query_store_enabled: Optional[bool] = None  # noqa: UP045

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None):  # noqa: UP045
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: MssqlConnection = config.serviceConnection.root.config
        if not isinstance(connection, MssqlConnection):
            raise InvalidSourceException(f"Expected MssqlConnection, but got {connection}")
        return cls(config, metadata)

    def uses_query_store(self) -> bool:
        """
        Auto-detect (once per run) whether to read query history from Query Store
        (durable) or the plan-cache DMVs (volatile), logging the chosen source.
        """
        if self._query_store_enabled is None:
            self._query_store_enabled = is_query_store_enabled(self.engine)
            if self._query_store_enabled:
                logger.info("MSSQL query history: Query Store is enabled, using it (durable).")
            else:
                logger.info(
                    "MSSQL query history: Query Store is not enabled, using plan-cache DMVs "
                    "which are volatile. Enable Query Store for durable history."
                )
        return self._query_store_enabled

    def resolve_query_log_statement(self) -> str:
        """
        The query-log statement template shared by lineage and usage: the Query
        Store variant when Query Store is enabled, otherwise the plan-cache DMV
        statement (`sql_stmt`).
        """
        return MSSQL_SQL_STATEMENT_FROM_QUERY_STORE if self.uses_query_store() else self.sql_stmt
