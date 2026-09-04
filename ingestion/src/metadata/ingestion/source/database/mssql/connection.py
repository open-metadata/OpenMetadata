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
Source connection handler
"""

from __future__ import annotations

from dataclasses import replace
from typing import TYPE_CHECKING

from sqlalchemy.engine import Engine

from metadata.core.connections.test_connection import ErrorPack, Matchers, check, when
from metadata.core.connections.test_connection.checks.database import (
    DEFAULT_SAMPLE_ROWS,
    DatabaseStep,
    list_schemas,
    ping,
    run_sql,
)
from metadata.core.connections.test_connection.checks.summary import enumerated
from metadata.core.connections.test_connection.classifier import exception_chain
from metadata.core.connections.test_connection.network import NETWORK_ERRORS
from metadata.core.connections.test_connection.records import Diagnosis, Evidence
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection as MssqlConnectionConfig,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_url_common,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.azuresql.connection import (
    get_connection_url as get_pyodbc_connection_url,
)
from metadata.ingestion.source.database.mssql.queries import (
    MSSQL_GET_CURRENT_DATABASE,
    MSSQL_GET_DATABASE,
    MSSQL_TEST_GET_QUERIES,
    MSSQL_TEST_GET_QUERIES_FROM_QUERY_STORE,
    MSSQL_TEST_GET_TABLES,
    MSSQL_TEST_GET_VIEWS,
)
from metadata.ingestion.source.database.mssql.utils import is_query_store_enabled

if TYPE_CHECKING:
    from collections.abc import Sequence

    from metadata.core.connections.lifetime import Borrowed
    from metadata.core.connections.test_connection import ChecksProvider
    from metadata.core.connections.test_connection.classifier import Matcher


def _mssql_number(error: BaseException) -> int | None:
    """The SQL Server error number, wherever the driver puts it.

    ``Matchers.errno`` misses it: no supported driver leaves an ``int`` at
    ``args[0]``. pytds uses ``.number``/``.msg_no``, pymssql a ``(number, message)``
    tuple at ``args[0]``, pyodbc none at all.
    """
    for current in exception_chain(error):
        for attribute in ("number", "msg_no"):
            value = getattr(current, attribute, None)
            if isinstance(value, int):
                return value
        args = getattr(current, "args", ())
        if args and isinstance(args[0], tuple) and args[0] and isinstance(args[0][0], int):
            return args[0][0]
    return None


def _sqlserver_errno(*codes: int) -> Matcher:
    """Match a SQL Server error by number, across the cause chain."""
    wanted = frozenset(codes)
    return lambda error: _mssql_number(error) in wanted


# pytds folds a multi-message failure unevenly (tds_session.raise_db_exception):
# the text joins every message, but the number is the LAST message's only. So a
# number is keyable only when it arrives last (observed live, pinned by tests):
#   missing database [4060,18456]->18456 ; no VIEW SERVER STATE [300,297]->297 ;
#   bad password [18456] ; denied SELECT [229]. Hence no 4060/300 rule.
# Numbers: https://learn.microsoft.com/en-us/sql/relational-databases/errors-events/database-engine-events-and-errors
SQLSERVER_ERRORS = ErrorPack(
    # Precedes the login rules: 4060's joined text ends "Login failed", and its
    # number (18456) also points at auth - so on a non-English server this reads
    # as an auth failure, the only signal available.
    when(Matchers.contains("Cannot open database")).diagnose(
        "Database not found or not accessible",
        fix="SQL Server would not open the database named in Database. Check the name is spelled "
        "correctly and exists on this server, and ask a SQL Server administrator to give the "
        "account in Username access to it.",
    ),
    when(
        Matchers.any_of(
            _sqlserver_errno(18456),
            Matchers.contains("Login failed"),
        )
    ).diagnose(
        "Authentication failed",
        fix="SQL Server rejected the sign-in. Check Username and Password. If both are correct, the "
        "account may be disabled or not allowed to sign in to this server - a SQL Server "
        "administrator can confirm.",
    ),
    # 297's text lacks "permission was denied", so its number is the only signal.
    when(
        Matchers.any_of(
            _sqlserver_errno(229, 297),
            Matchers.contains("permission was denied"),
        )
    ).diagnose(
        "Insufficient privileges",
        fix="The account signed in but is not allowed to read what this step needs. Ask a SQL "
        "Server administrator to GRANT SELECT on those objects to it - and GRANT VIEW SERVER STATE "
        "as well if you want query history collected.",
    ),
)

MSSQL_ERRORS = SQLSERVER_ERRORS.including(NETWORK_ERRORS)


def get_connection_url(connection: MssqlConnectionConfig) -> str:
    if connection.scheme.value == connection.scheme.mssql_pyodbc.value:
        return get_pyodbc_connection_url(connection)
    return get_connection_url_common(connection)


class MssqlChecks:
    """Test-connection checks for SQL Server (MSSQL)."""

    errors = MSSQL_ERRORS

    def __init__(self, db: Borrowed[Engine], get_databases_statement: str) -> None:
        self._db = db
        self.get_databases_statement = get_databases_statement

    @check(DatabaseStep.CheckAccess)
    def check_access(self) -> Evidence:
        return ping(self._db.client)

    @check(DatabaseStep.GetDatabases)
    def get_databases(self) -> Evidence:
        return run_sql(
            self._db.client,
            self.get_databases_statement,
            lambda rows: enumerated(len(rows), "database", DEFAULT_SAMPLE_ROWS),
        )

    @check(DatabaseStep.GetSchemas)
    def get_schemas(self) -> Evidence:
        return list_schemas(self._db.client)

    @check(DatabaseStep.GetTables)
    def get_tables(self) -> Evidence:
        return self._probe_existence(MSSQL_TEST_GET_TABLES, "table", warn_on_empty=True)

    @check(DatabaseStep.GetViews)
    def get_views(self) -> Evidence:
        # An empty view list is normal, unlike an empty table list - stays silent
        # on empty.
        return self._probe_existence(MSSQL_TEST_GET_VIEWS, "view", warn_on_empty=False)

    def _probe_existence(self, statement: str, kind: str, warn_on_empty: bool) -> Evidence:
        """Whether the database has any user-created objects ``statement`` probes for.

        See ``MSSQL_TEST_GET_TABLES``/``MSSQL_TEST_GET_VIEWS`` for why the query
        is TOP 1, no ORDER BY, and filtered to ``is_ms_shipped = 0``.
        """
        empty_summary = f"no {kind}s visible"

        def summarize(rows: Sequence[object]) -> str:
            return empty_summary if not rows else f"{kind}s visible"

        evidence = run_sql(self._db.client, statement, summarize, max_rows=1)
        if not warn_on_empty or evidence.summary != empty_summary:
            return evidence
        return replace(
            evidence,
            caveat=Diagnosis(
                title=f"No {kind}s visible",
                remediation=f"Verify the login can see {kind}s (object permissions), or confirm the database is not empty.",
            ),
        )

    @check(DatabaseStep.GetQueries)
    def get_queries(self) -> Evidence:
        if is_query_store_enabled(self._db.client):
            query = MSSQL_TEST_GET_QUERIES_FROM_QUERY_STORE
            summary = "query history accessible via Query Store"
        else:
            query = MSSQL_TEST_GET_QUERIES
            summary = "query history accessible via plan-cache DMVs"
        return run_sql(self._db.client, query, lambda _: summary)


class MssqlConnection(BaseConnection[MssqlConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        engine = create_generic_db_connection(
            connection=self.service_connection,
            get_connection_url_fn=get_connection_url,
            get_connection_args_fn=get_connection_args_common,
        )
        self._on_close(engine.dispose)
        return engine

    def _get_databases_statement(self) -> str:
        if self.service_connection.ingestAllDatabases:
            return MSSQL_GET_DATABASE
        return MSSQL_GET_CURRENT_DATABASE

    def checks(self) -> ChecksProvider:
        return MssqlChecks(
            db=self.borrow(),
            get_databases_statement=self._get_databases_statement(),
        )
