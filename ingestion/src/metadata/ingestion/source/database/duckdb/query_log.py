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
Query history for the DuckDB usage and lineage sources.

DuckDB keeps no query history in the database file: its ``duckdb_logs`` view is
in-memory and per process, so a separate ingestion process would only ever see its
own queries. Usage and query lineage therefore read an opt-in table,
``main.duckdb_query_log``, that the workload writes to. Without that table both
workflows return no queries; view lineage does not depend on it. See
ADR:2026-11-23-duckdb-ingests-one-file-as-one-database-and-reads-query-history-only-from-its-query-log-table.
"""

from datetime import datetime

from metadata.generated.schema.entity.services.connections.database.duckDBConnection import (
    DuckDBConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.duckdb.connection import get_database_name
from metadata.ingestion.source.database.duckdb.queries import (
    DUCKDB_EMPTY_SQL_STATEMENT,
    DUCKDB_QUERY_LOG_EXISTS,
    DUCKDB_QUERY_LOG_TABLE,
    DUCKDB_SQL_STATEMENT,
)
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DuckDBQueryParserSource(QueryParserSource):
    sql_stmt = DUCKDB_SQL_STATEMENT
    database_field = "database_name"
    schema_field = "schema_name"

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: str | None = None,
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        service_connection = config.serviceConnection
        connection = service_connection.root.config if service_connection else None
        if not isinstance(connection, DuckDBConnection):
            raise InvalidSourceException(f"Expected DuckDBConnection, but got {connection}")
        return cls(config, metadata)

    def _query_log_exists(self) -> bool:
        with self.engine.connect() as conn:  # pyright: ignore[reportOptionalMemberAccess]
            return conn.execute(DUCKDB_QUERY_LOG_EXISTS).first() is not None

    def get_sql_statement(self, start_time: datetime, end_time: datetime) -> str:
        if not self._query_log_exists():
            logger.info(
                "DuckDB table %s not found: no query history to read. "
                "Create and populate it to ingest usage and query lineage.",
                DUCKDB_QUERY_LOG_TABLE,
            )
            return DUCKDB_EMPTY_SQL_STATEMENT
        database_name = get_database_name(self.engine, self.service_connection)  # pyright: ignore[reportArgumentType]
        return self.sql_stmt.format(
            start_time=start_time,
            end_time=end_time,
            filters=self.get_filters(),
            result_limit=self.source_config.resultLimit,  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess]
            database_name=_as_text_literal_body(database_name),
        )


def _as_text_literal_body(value: str) -> str:
    """Escape a value for a single-quoted literal in SQL the base sources run through ``text()``.

    Doubling quotes keeps the literal closed; ``\\:`` stops ``text()`` reading a colon as a bind parameter.
    """
    return value.replace("'", "''").replace(":", r"\:")
