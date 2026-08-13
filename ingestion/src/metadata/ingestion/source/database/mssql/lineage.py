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
MSSQL lineage module
"""

import traceback
from datetime import datetime
from typing import Iterator  # noqa: UP035

from sqlalchemy import text
from sqlalchemy.engine import Engine

from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.mssql.constants import (
    DEFAULT_DATETIME_FORMAT,
    MSSQL_DATEFORMAT_DATETIME_MAP,
)
from metadata.ingestion.source.database.mssql.queries import (
    MSSQL_GET_STORED_PROCEDURE_QUERIES,
    MSSQL_GET_STORED_PROCEDURE_QUERIES_FROM_QUERY_STORE,
    MSSQL_GET_SYNONYMS,
    MSSQL_SQL_STATEMENT,
)
from metadata.ingestion.source.database.mssql.query_parser import MssqlQueryParserSource
from metadata.ingestion.source.database.mssql.synonyms import SynonymResolver
from metadata.ingestion.source.database.mssql.utils import (
    get_sqlalchemy_engine_dateformat,
)
from metadata.ingestion.source.database.stored_procedures_mixin import (
    StoredProcedureLineageMixin,
)
from metadata.ingestion.source.models import TableView
from metadata.utils.helpers import get_start_and_end
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class MssqlLineageSource(MssqlQueryParserSource, StoredProcedureLineageMixin, LineageSource):
    sql_stmt = MSSQL_SQL_STATEMENT

    _synonyms: SynonymResolver | None = None

    filters = """
        AND (
            lower(t.text) LIKE '%%select%%into%%'
            OR lower(t.text) LIKE '%%insert%%into%%select%%'
            OR lower(t.text) LIKE '%%update%%'
            OR lower(t.text) LIKE '%%merge%%'
        )
        AND lower(t.text) NOT LIKE '%%create%%procedure%%'
        AND lower(t.text) NOT LIKE '%%create%%function%%'
        AND lower(t.text) NOT LIKE '%%declare%%'
    """

    def get_sql_statement(self, start_time: datetime, end_time: datetime) -> str:
        """
        returns sql statement to fetch query logs.
        """
        server_date_format = get_sqlalchemy_engine_dateformat(self.engine)
        current_datetime_format = MSSQL_DATEFORMAT_DATETIME_MAP.get(server_date_format, DEFAULT_DATETIME_FORMAT)
        return self.resolve_query_log_statement().format(
            start_time=start_time.strftime(current_datetime_format),
            end_time=end_time.strftime(current_datetime_format),
            filters=self.get_filters(),
            result_limit=self.source_config.resultLimit,
        )

    def get_stored_procedure_sql_statement(self) -> str:
        """
        Return the SQL statement to get the stored procedure queries.

        Uses Query Store when enabled (durable, per-statement text tied to the
        parent procedure via object_id), otherwise the plan-cache DMV query, which
        cannot reliably attribute a procedure's DML statements to it.
        """
        start, _ = get_start_and_end(self.source_config.queryLogDuration)
        server_date_format = get_sqlalchemy_engine_dateformat(self.engine)
        current_datetime_format = MSSQL_DATEFORMAT_DATETIME_MAP.get(server_date_format, DEFAULT_DATETIME_FORMAT)
        start = start.strftime(current_datetime_format)
        use_query_store = self._active_query_store if self._active_query_store is not None else self.uses_query_store()
        template = (
            MSSQL_GET_STORED_PROCEDURE_QUERIES_FROM_QUERY_STORE
            if use_query_store
            else MSSQL_GET_STORED_PROCEDURE_QUERIES
        )
        return template.format(start_date=start)

    def get_stored_procedure_engines(self) -> Iterator[Engine]:
        """
        Read stored-procedure query history per database, mirroring get_engine so
        Query Store coverage spans every database on an ingest-all-databases run.
        """
        yield from self.get_engine()

    @property
    def synonyms(self) -> SynonymResolver:
        """
        The synonym-to-base-object mapping for every database in scope, read once per run.

        Synonyms are per-database, so each database is read through its own engine.
        """
        if self._synonyms is None:
            self._synonyms = self._read_synonyms()
        return self._synonyms

    def _synonym_engines(self) -> Iterator[Engine]:
        """
        One engine per database in scope, to read that database's synonyms from.

        Deliberately not get_engine(): that one also decides, per database, which
        query-log statement the run uses, and reading synonyms must not disturb it.
        """
        databases = (
            list(self._databases_to_scan()) if getattr(self.service_connection, "ingestAllDatabases", False) else []
        )
        if not databases:
            yield self.engine
            return
        for database in databases:
            engine = self._engine_for_database(database)
            try:
                yield engine
            finally:
                engine.dispose()

    def _read_synonyms(self) -> SynonymResolver:
        resolver = SynonymResolver()
        for engine in self._synonym_engines():
            try:
                with engine.connect() as connection:
                    rows = connection.execute(text(MSSQL_GET_SYNONYMS)).fetchall()
            except Exception as exc:
                logger.warning(f"Could not read synonyms, lineage through them will be missing: {exc}")
                logger.debug(traceback.format_exc())
                continue
            for row in rows:
                resolver.add(
                    database=row.database_name,
                    schema=row.schema_name,
                    synonym=row.synonym_name,
                    base_object_name=row.base_object_name,
                )
        if resolver.is_empty():
            logger.debug("No synonyms found, lineage SQL will be used as written")
        else:
            logger.info(f"Resolving lineage through {len(resolver)} synonym(s)")
        if resolver.skipped:
            logger.info(
                f"{resolver.skipped} synonym(s) point at linked-server objects, "
                "which OpenMetadata does not ingest: lineage through them is not created"
            )
        return resolver

    def view_lineage_producer(self) -> Iterator[TableView]:
        """Resolve the synonyms a view reads through before its DDL is parsed."""
        for view in super().view_lineage_producer():
            yield view.model_copy(
                update={
                    "view_definition": self.synonyms.rewrite(
                        view.view_definition,
                        database=view.db_name,
                        schema=view.schema_name,
                    )
                }
            )

    def query_lineage_producer(self) -> Iterator[TableQuery]:
        """
        Resolve the synonyms a logged query reads through before it is parsed.

        SQL Server stores query text as it was submitted, so a query written against
        a synonym names it verbatim and would otherwise resolve to nothing.
        """
        for table_query in super().query_lineage_producer():
            yield table_query.model_copy(
                update={
                    "query": self.synonyms.rewrite(
                        table_query.query,
                        database=table_query.databaseName,
                        schema=table_query.databaseSchema,
                    )
                }
            )
