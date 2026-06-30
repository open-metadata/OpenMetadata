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

from typing import TYPE_CHECKING

from sqlalchemy.engine import Engine

from metadata.core.connections.test_connection import ErrorPack, Matchers, check, when
from metadata.core.connections.test_connection.checks.database import (
    DEFAULT_SAMPLE_ROWS,
    DatabaseStep,
    list_schemas,
    list_tables,
    list_views,
    ping,
    run_sql,
)
from metadata.core.connections.test_connection.network import NETWORK_ERRORS
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
)

if TYPE_CHECKING:
    from collections.abc import Sequence

    from metadata.core.connections.test_connection import ChecksProvider
    from metadata.core.connections.test_connection.records import Evidence


# --- SQL Server error pack ---------------------------------------------------
# Grouped and self-contained so the Fabric (Database) connector, which speaks the
# same SQL Server protocol, can lift it verbatim later.
#
# The two supported drivers surface SQL Server errors differently:
#   * pymssql exposes the numeric SQL Server error in ``args[0]`` -> Matchers.errno
#   * pyodbc exposes a string SQLSTATE + message text -> Matchers.contains
# Both shapes are covered per failure mode; first match wins, so the errno and the
# message rule fold to the same diagnosis whichever driver raised.
#
# Error numbers are from the SQL Server system error message reference
# (https://learn.microsoft.com/en-us/sql/relational-databases/errors-events/database-engine-events-and-errors).
SQLSERVER_ERRORS = ErrorPack(
    # Database missing / not accessible MUST be matched before the login rules: SQL
    # Server's 4060 message is "Cannot open database "X" requested by the login. The
    # login failed." - it contains "login failed", so a login-first ordering would
    # misclassify a missing database as an auth failure (confirmed live on pytds).
    # 4060 (cannot open database requested by the login), 911 (database does not exist).
    when(Matchers.errno(4060, 911)).diagnose(
        "Database not found or not accessible",
        fix="Verify the configured database exists and the login is allowed to open it.",
    ),
    when(Matchers.contains("Cannot open database")).diagnose(
        "Database not found or not accessible",
        fix="Verify the configured database exists and the login is allowed to open it.",
    ),
    # Login failed (auth). SQL Server error 18456; message "Login failed for user".
    when(Matchers.errno(18456)).diagnose(
        "Authentication failed",
        fix="Check the username and password, and that the login is allowed to connect.",
    ),
    when(Matchers.contains("Login failed")).diagnose(
        "Authentication failed",
        fix="Check the username and password, and that the login is allowed to connect.",
    ),
    # Permission denied. 229 (permission denied on object), 297 (no permission for the
    # action), 262 (statement permission denied); message "permission was denied".
    when(Matchers.errno(229, 297, 262)).diagnose(
        "Insufficient privileges",
        fix="Grant the login SELECT on the objects the failing step reads (and VIEW SERVER STATE for query history).",
    ),
    when(Matchers.contains("permission was denied")).diagnose(
        "Insufficient privileges",
        fix="Grant the login SELECT on the objects the failing step reads (and VIEW SERVER STATE for query history).",
    ),
)

MSSQL_ERRORS = SQLSERVER_ERRORS.including(NETWORK_ERRORS)


def _databases_enumerated(rows: Sequence[object]) -> str:
    """Summarize the GetDatabases probe without overstating the count.

    ``run_sql`` fetches at most ``DEFAULT_SAMPLE_ROWS`` rows, so on an instance
    with more databases than the cap the count saturates; report it as ``N+`` so
    the evidence reads as a floor, not an exact total.
    """
    count = len(rows)
    label = f"{count}+" if count >= DEFAULT_SAMPLE_ROWS else str(count)
    return f"{label} databases enumerated"


def get_connection_url(connection: MssqlConnectionConfig) -> str:
    if connection.scheme.value == connection.scheme.mssql_pyodbc.value:
        return get_pyodbc_connection_url(connection)
    return get_connection_url_common(connection)


class MssqlChecks:
    """Test-connection checks for SQL Server (MSSQL)."""

    errors = MSSQL_ERRORS

    # SQL Server system / fixed-role schemas - skipped when auto-selecting a schema
    # to probe, so table/view checks land on a real user schema.
    SYSTEM_SCHEMAS = frozenset(
        {
            "sys",
            "information_schema",
            "guest",
            "db_owner",
            "db_accessadmin",
            "db_securityadmin",
            "db_ddladmin",
            "db_backupoperator",
            "db_datareader",
            "db_datawriter",
            "db_denydatareader",
            "db_denydatawriter",
        }
    )

    def __init__(self, client: Engine, get_databases_statement: str) -> None:
        self.client = client
        self.get_databases_statement = get_databases_statement

    @check(DatabaseStep.CheckAccess)
    def check_access(self) -> Evidence:
        return ping(self.client)

    @check(DatabaseStep.GetDatabases)
    def get_databases(self) -> Evidence:
        return run_sql(self.client, self.get_databases_statement, _databases_enumerated)

    @check(DatabaseStep.GetSchemas)
    def get_schemas(self) -> Evidence:
        return list_schemas(self.client)

    @check(DatabaseStep.GetTables)
    def get_tables(self) -> Evidence:
        return list_tables(self.client, None, self.SYSTEM_SCHEMAS)

    @check(DatabaseStep.GetViews)
    def get_views(self) -> Evidence:
        return list_views(self.client, None, self.SYSTEM_SCHEMAS)

    @check(DatabaseStep.GetQueries)
    def get_queries(self) -> Evidence:
        return run_sql(self.client, MSSQL_TEST_GET_QUERIES, lambda _: "query history accessible")


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
            client=self.client,
            get_databases_statement=self._get_databases_statement(),
        )
