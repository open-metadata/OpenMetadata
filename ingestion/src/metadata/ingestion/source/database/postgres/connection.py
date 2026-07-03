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
from metadata.core.connections.test_connection.classifier import exception_chain
from metadata.core.connections.test_connection.network import NETWORK_ERRORS
from metadata.generated.schema.entity.services.connections.database.common.azureConfig import (
    AzureConfigurationSource,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection as PostgresConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.strategies import AzureAdStrategy, BasicAuthStrategy
from metadata.ingestion.source.database.postgres.queries import (
    POSTGRES_GET_DATABASE,
    POSTGRES_TEST_GET_QUERIES,
    POSTGRES_TEST_GET_TAGS,
    TEST_COLUMN_METADATA,
    TEST_INFORMATION_SCHEMA_COLUMNS,
    TEST_TABLE_COMMENTS,
)
from metadata.ingestion.source.database.postgres.utils import (
    get_postgres_time_column_name,
)

if TYPE_CHECKING:
    from metadata.core.connections.test_connection import ChecksProvider
    from metadata.core.connections.test_connection.classifier import Matcher
    from metadata.core.connections.test_connection.records import Evidence


def _pgcode(error: BaseException) -> str | None:
    """The PostgreSQL SQLSTATE on the error or anywhere in its cause chain.

    psycopg2 exposes it on ``.pgcode``; SQLAlchemy preserves the original DBAPI
    error at ``.orig``, so we check both across the chain. Note SQLSTATE is only
    populated for *query-execution* errors - a failed connection (bad password,
    missing database) raises before a session exists, so those carry no code and
    must be matched on message text instead.
    """
    for current in exception_chain(error):
        code = getattr(current, "pgcode", None)
        if code is None:
            code = getattr(getattr(current, "orig", None), "pgcode", None)
        if code is not None:
            return code
    return None


def _sqlstate(*codes: str) -> Matcher:
    """Match a PostgreSQL SQLSTATE - the stable signal for query-execution errors,
    where the message text varies by locale."""
    wanted = frozenset(codes)
    return lambda error: _pgcode(error) in wanted


def _message(error: BaseException) -> str:
    """The lower-cased text of the error and its cause chain."""
    return " ".join(str(current) for current in exception_chain(error)).lower()


def _database_not_found(error: BaseException) -> bool:
    """psycopg2 reports a missing database at connect time as
    ``FATAL: database "x" does not exist`` with no SQLSTATE. Match the quoted token
    ``database "`` so a query error whose embedded SQL mentions ``pg_database`` (or
    a missing relation) is not misread as a missing database."""
    text = _message(error)
    return 'database "' in text and "does not exist" in text


def _role_not_found(error: BaseException) -> bool:
    """psycopg2 reports an unknown role at connect time as
    ``FATAL: role "x" does not exist`` with no SQLSTATE (only under trust/peer auth;
    password auth returns "password authentication failed" instead, to avoid role
    enumeration). Match the quoted token ``role "`` so it is not confused with the
    ``database "`` case, which shares the ``does not exist`` suffix."""
    text = _message(error)
    return 'role "' in text and "does not exist" in text


# Connect-phase failures (auth, missing database) carry no SQLSTATE, so they are
# matched on message text; query-phase failures are matched on the stable SQLSTATE
# psycopg2 surfaces on ``.pgcode``. Bad host / port raise before the driver and are
# caught by the TCP preflight in ``ping`` via NETWORK_ERRORS.
POSTGRES_ERRORS = ErrorPack(
    when(Matchers.contains("password authentication failed")).diagnose(
        "Authentication failed",
        fix="Check the username and password, and that the user is allowed to connect.",
    ),
    when(_role_not_found).diagnose(
        "Authentication failed",
        fix="Check the username - the configured role does not exist on the server.",
    ),
    when(Matchers.contains("no pg_hba.conf entry")).diagnose(
        "Connection not permitted by pg_hba.conf",
        fix="Add a pg_hba.conf entry for this user and host, and enable SSL if the server requires it.",
    ),
    when(_database_not_found).diagnose(
        "Database not found",
        fix="Verify the configured database exists and the user is allowed to connect to it.",
    ),
    when(_sqlstate("42501")).diagnose(  # insufficient_privilege
        "Insufficient privileges",
        fix="Grant the user SELECT on the objects the failing step reads.",
    ),
    # 42P01 (undefined_table) across the test steps can only come from the GetQueries
    # source probe - every other step reads system catalogs that always exist - so it
    # means the configured queryStatementSource is missing, whatever it is named.
    when(_sqlstate("42P01")).diagnose(  # undefined_table
        "Query history source not found",
        fix="The query history source (queryStatementSource, default pg_stat_statements) does not "
        "exist. Install/enable it (e.g. the pg_stat_statements extension) or correct the setting, "
        "or query usage and lineage won't be collected.",
    ),
).including(NETWORK_ERRORS)


class PostgresChecks:
    """Test-connection checks for PostgreSQL."""

    errors = POSTGRES_ERRORS

    # System schemas - skipped when auto-selecting a schema to probe.
    SYSTEM_SCHEMAS = frozenset({"information_schema", "pg_catalog", "pg_toast"})

    def __init__(self, client: Engine, query_statement_source: str | None) -> None:
        self.client = client
        self.query_statement_source = query_statement_source

    @check(DatabaseStep.CheckAccess)
    def check_access(self) -> Evidence:
        return ping(self.client)

    @check(DatabaseStep.GetDatabases)
    def get_databases(self) -> Evidence:
        return run_sql(self.client, POSTGRES_GET_DATABASE, self._summarize_databases)

    @staticmethod
    def _summarize_databases(rows: list) -> str:
        # run_sql fetches at most DEFAULT_SAMPLE_ROWS; at the cap the exact total is
        # unknown, so report "N+" rather than implying a complete enumeration.
        count = len(rows)
        label = f"{count}+" if count >= DEFAULT_SAMPLE_ROWS else str(count)
        return f"{label} databases enumerated"

    @check(DatabaseStep.GetSchemas)
    def get_schemas(self) -> Evidence:
        return list_schemas(self.client)

    @check(DatabaseStep.GetTables)
    def get_tables(self) -> Evidence:
        return list_tables(self.client, None, self.SYSTEM_SCHEMAS)

    @check(DatabaseStep.GetViews)
    def get_views(self) -> Evidence:
        return list_views(self.client, None, self.SYSTEM_SCHEMAS)

    @check(DatabaseStep.GetTags)
    def get_tags(self) -> Evidence:
        return run_sql(self.client, POSTGRES_TEST_GET_TAGS, lambda _: "policy tags accessible")

    @check(DatabaseStep.GetQueries)
    def get_queries(self) -> Evidence:
        # Built here, not at construction, so the version-probe query runs only
        # after CheckAccess has confirmed reachability - never ahead of the gate.
        statement = POSTGRES_TEST_GET_QUERIES.format(
            time_column_name=get_postgres_time_column_name(engine=self.client),
            query_statement_source=self.query_statement_source or "pg_stat_statements",
        )
        return run_sql(self.client, statement, lambda _: "query history accessible")

    @check(DatabaseStep.GetColumnMetadata)
    def get_column_metadata(self) -> Evidence:
        return run_sql(self.client, TEST_COLUMN_METADATA, lambda _: "column metadata accessible")

    @check(DatabaseStep.GetTableComments)
    def get_table_comments(self) -> Evidence:
        return run_sql(self.client, TEST_TABLE_COMMENTS, lambda _: "table comments accessible")

    @check(DatabaseStep.GetInformationSchemaColumns)
    def get_information_schema_columns(self) -> Evidence:
        return run_sql(self.client, TEST_INFORMATION_SCHEMA_COLUMNS, lambda _: "information_schema.columns accessible")


class PostgresConnection(BaseConnection[PostgresConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        match self.service_connection.authType:
            case AzureConfigurationSource() as azure_auth:
                engine = AzureAdStrategy(self.service_connection, azure_auth).build()
            case _:
                engine = BasicAuthStrategy(self.service_connection).build()
        self._on_close(engine.dispose)
        return engine

    def checks(self) -> ChecksProvider:
        return PostgresChecks(
            client=self.client,
            query_statement_source=self.service_connection.queryStatementSource,
        )
