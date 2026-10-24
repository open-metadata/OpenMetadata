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

import re
import traceback
from collections.abc import Iterator
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.exc import SQLAlchemyError

from metadata.ingestion.lineage.parser import TSQL_SWITCH_STATEMENT
from metadata.ingestion.source.database.lineage_processors import QueryByProcedure
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.mssql.constants import (
    DEFAULT_DATETIME_FORMAT,
    MSSQL_DATEFORMAT_DATETIME_MAP,
)
from metadata.ingestion.source.database.mssql.queries import (
    MSSQL_GET_STORED_PROCEDURE_QUERIES,
    MSSQL_GET_STORED_PROCEDURE_QUERIES_FROM_QUERY_STORE,
    MSSQL_GET_STORED_PROCEDURE_SWITCH_DEFINITIONS,
    MSSQL_SQL_STATEMENT,
)
from metadata.ingestion.source.database.mssql.query_parser import MssqlQueryParserSource
from metadata.ingestion.source.database.mssql.utils import (
    get_sqlalchemy_engine_dateformat,
)
from metadata.ingestion.source.database.stored_procedures_mixin import (
    StoredProcedureLineageMixin,
)
from metadata.utils.helpers import get_start_and_end
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Quoted names, string literals and comments, matched left to right so that a quote or a
# comment marker inside one of them is not read as the start of another.
_SQL_QUOTED_OR_COMMENT = re.compile(
    r"""\[(?:[^\]]|\]\])*\]|"(?:[^"]|"")*"|'(?:[^']|'')*'|/\*.*?\*/|--[^\n]*""",
    re.DOTALL,
)


def _blank_strings_and_comments(code: str) -> str:
    return _SQL_QUOTED_OR_COMMENT.sub(lambda match: match.group(0) if match.group(0)[0] in '["' else " ", code)


def extract_switch_statements(definition: str | None) -> list[str]:
    """
    The ALTER TABLE ... SWITCH statements of a procedure body, in order and each once.
    String literals and comments are blanked first, so a SWITCH that is printed or
    commented out yields no lineage.
    """
    code = _blank_strings_and_comments(definition or "")
    return list(dict.fromkeys(match.group(0) for match in TSQL_SWITCH_STATEMENT.finditer(code)))


class MssqlLineageSource(MssqlQueryParserSource, StoredProcedureLineageMixin, LineageSource):
    sql_stmt = MSSQL_SQL_STATEMENT

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
        start = self._stored_procedure_history_start()
        use_query_store = self._active_query_store if self._active_query_store is not None else self.uses_query_store()
        template = (
            MSSQL_GET_STORED_PROCEDURE_QUERIES_FROM_QUERY_STORE
            if use_query_store
            else MSSQL_GET_STORED_PROCEDURE_QUERIES
        )
        return template.format(start_date=start)

    def _stored_procedure_history_start(self) -> str:
        start, _ = get_start_and_end(self.source_config.queryLogDuration)
        server_date_format = get_sqlalchemy_engine_dateformat(self.engine)
        current_datetime_format = MSSQL_DATEFORMAT_DATETIME_MAP.get(server_date_format, DEFAULT_DATETIME_FORMAT)
        return start.strftime(current_datetime_format)

    def yield_supplementary_stored_procedure_queries(self, conn: Connection) -> Iterator[QueryByProcedure]:
        """
        SQL Server records no statement for DDL, so a procedure's ALTER TABLE ... SWITCH is
        in neither Query Store nor the plan cache. Yield each SWITCH in the definition of a
        procedure that ran as one of its queries. The execution stats need VIEW SERVER STATE,
        which a Query Store reader may lack, so a failed read only loses the SWITCH lineage
        (ADR:2026-10-22-mssql-switch-lineage-comes-from-executed-procedure-definitions).
        """
        statement = MSSQL_GET_STORED_PROCEDURE_SWITCH_DEFINITIONS.format(
            start_date=self._stored_procedure_history_start()
        )
        try:
            rows = conn.execute(text(statement)).all()
        except SQLAlchemyError as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                "Could not read executed stored procedures for ALTER TABLE ... SWITCH lineage: %s",
                getattr(exc, "orig", exc),
            )
            rows = []
        for row in rows:
            procedure_run = QueryByProcedure.model_validate(row._asdict())
            for switch in extract_switch_statements(procedure_run.procedure_text):
                yield procedure_run.model_copy(update={"query_text": switch})

    def get_stored_procedure_engines(self) -> Iterator[Engine]:
        """
        Read stored-procedure query history per database, mirroring get_engine so
        Query Store coverage spans every database on an ingest-all-databases run.
        """
        yield from self.get_engine()
