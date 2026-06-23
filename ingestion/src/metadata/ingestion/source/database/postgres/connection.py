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
        code = getattr(current, "pgcode", None) or getattr(getattr(current, "orig", None), "pgcode", None)
        if code:
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
    ``FATAL: database "x" does not exist`` with no SQLSTATE; require both tokens so
    a later ``relation ... does not exist`` query error is not misread as this."""
    text = _message(error)
    return "database" in text and "does not exist" in text


# Connect-phase failures (auth, missing database) carry no SQLSTATE, so they are
# matched on message text; query-phase failures (privileges) are matched on the
# stable SQLSTATE psycopg2 surfaces on ``.pgcode``. Bad host / port raise before
# the driver and are caught by the TCP preflight in ``ping`` via NETWORK_ERRORS.
POSTGRES_ERRORS = ErrorPack(
    when(Matchers.contains("password authentication failed")).diagnose(
        "Authentication failed",
        fix="Check the username and password, and that the user is allowed to connect.",
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
).including(NETWORK_ERRORS)


class PostgresChecks:
    """Test-connection checks for PostgreSQL."""

    errors = POSTGRES_ERRORS

    # System schemas - skipped when auto-selecting a schema to probe.
    SYSTEM_SCHEMAS = frozenset({"information_schema", "pg_catalog", "pg_toast"})

    def __init__(self, client: Engine, queries_statement: str) -> None:
        self.client = client
        self.queries_statement = queries_statement

    @check(DatabaseStep.CheckAccess)
    def check_access(self) -> Evidence:
        return ping(self.client)

    @check(DatabaseStep.GetDatabases)
    def get_databases(self) -> Evidence:
        return run_sql(self.client, POSTGRES_GET_DATABASE, lambda rows: f"{len(rows)} databases enumerated")

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
        return run_sql(self.client, self.queries_statement, lambda _: "query history accessible")

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

    def _test_queries_statement(self) -> str:
        return POSTGRES_TEST_GET_QUERIES.format(
            time_column_name=get_postgres_time_column_name(engine=self.client),
            query_statement_source=self.service_connection.queryStatementSource or "pg_stat_statements",
        )

    def checks(self) -> ChecksProvider:
        return PostgresChecks(
            client=self.client,
            queries_statement=self._test_queries_statement(),
        )
