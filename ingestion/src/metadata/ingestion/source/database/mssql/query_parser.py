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
from copy import deepcopy
from typing import Iterator, Optional  # noqa: UP035

from sqlalchemy import text
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.mssql.queries import (
    MSSQL_GET_QUERY_STORE_DATABASES,
    MSSQL_SQL_STATEMENT_FROM_QUERY_STORE,
)
from metadata.ingestion.source.database.mssql.utils import is_query_store_enabled
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_manager import get_ssl_connection

logger = ingestion_logger()


class MssqlQueryParserSource(QueryParserSource, ABC):
    """
    MSSQL base for Usage and Lineage
    """

    filters: str
    engine: Engine
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
                    "MSSQL query history: Query Store is not enabled or not accessible, using "
                    "plan-cache DMVs which are volatile. Enable Query Store for durable history."
                )
        return self._query_store_enabled

    def resolve_query_log_statement(self) -> str:
        """
        The query-log statement template shared by lineage and usage: the Query
        Store variant when Query Store is enabled, otherwise the plan-cache DMV
        statement (`sql_stmt`).
        """
        return MSSQL_SQL_STATEMENT_FROM_QUERY_STORE if self.uses_query_store() else self.sql_stmt

    def get_engine(self):
        """
        Query Store is a per-database feature, so when ingesting all databases we
        probe and read each database's own Query Store through its own connection.
        The plan-cache DMV path stays on the single instance-wide connection because
        those DMVs already return history for every database on the server in one pass.
        """
        if self.uses_query_store() and getattr(self.service_connection, "ingestAllDatabases", False):
            yield from self._query_store_database_engines()
        else:
            yield self.engine

    def _query_store_database_engines(self) -> Iterator[Engine]:
        """
        Yield one engine per user database that has Query Store enabled. Each database
        is probed on its own connection, so its Query Store state decides routing rather
        than the initial connection's. Databases without Query Store, or that cannot be
        reached, are skipped and logged so a single one never aborts the whole run.
        """
        for database in self._databases_to_scan():
            engine = self._engine_for_database(database)
            try:
                if is_query_store_enabled(engine):
                    yield engine
                else:
                    logger.info(
                        f"MSSQL query history: Query Store is not enabled or not accessible on "
                        f"database {database}, skipping it. Enable Query Store there for coverage."
                    )
            finally:
                engine.dispose()

    def _databases_to_scan(self) -> Iterator[str]:
        with self.engine.connect() as conn:
            rows = conn.execute(text(MSSQL_GET_QUERY_STORE_DATABASES)).fetchall()
        database_filter = getattr(self.source_config, "databaseFilterPattern", None)
        for row in rows:
            database = row[0]
            if not filter_by_database(database_filter, database):
                yield database

    def _engine_for_database(self, database: str) -> Engine:
        connection = deepcopy(self.service_connection)
        connection.database = database
        return get_ssl_connection(connection)
