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
    MSSQL_QUERY_STORE_SQL_STATEMENT,
)
from metadata.ingestion.source.database.mssql.utils import should_use_query_store
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class MssqlQueryParserSource(QueryParserSource, ABC):
    """
    MSSQL base for Usage and Lineage
    """

    filters: str
    # Durable query-history statement, used when Query Store is enabled on the DB
    query_store_sql_stmt: str = MSSQL_QUERY_STORE_SQL_STATEMENT
    _use_query_store: Optional[bool] = None  # noqa: UP045

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None):  # noqa: UP045
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: MssqlConnection = config.serviceConnection.root.config
        if not isinstance(connection, MssqlConnection):
            raise InvalidSourceException(f"Expected MssqlConnection, but got {connection}")
        return cls(config, metadata)

    def use_query_store(self) -> bool:
        """
        Whether to read query history from Query Store (durable) instead of the
        volatile plan cache. Detected once per run and cached.

        Query Store is opt-in via the connection's ``useQueryStore`` flag; when
        it is off the connector uses the plan cache exactly as before (no probe).
        Query Store views are also per-database, so the durable path is only used
        for single-database services (not ingestAllDatabases) to avoid silently
        dropping other databases' queries.
        """
        if self._use_query_store is None:
            use_query_store_flag = getattr(self.service_connection, "useQueryStore", False)
            self._use_query_store = (
                use_query_store_flag
                and bool(self.engine)
                and not self.service_connection.ingestAllDatabases
                and should_use_query_store(self.engine)
            )
            if use_query_store_flag:
                query_source = "Query Store (durable history)" if self._use_query_store else "plan cache (dm_exec_*)"
                logger.info(f"MSSQL lineage/usage query source: {query_source}")
        return self._use_query_store

    def get_query_log_statement(self) -> str:
        """
        Return the query-log statement to run: the plan-cache statement by
        default, or the Query Store statement when it is enabled on the database.
        """
        return self.query_store_sql_stmt if self.use_query_store() else self.sql_stmt
