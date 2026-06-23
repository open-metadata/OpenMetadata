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
"""Unit tests for PostgreSQL connection handling (auth strategies + checks)."""

import socket
from unittest.mock import MagicMock, patch

import pytest
from azure.core.credentials import AccessToken
from azure.identity import ClientSecretCredential
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from metadata.core.connections.test_connection.check import CheckError, collect_checks
from metadata.core.connections.test_connection.checks.database import DatabaseStep
from metadata.core.connections.test_connection.network import NetworkUnreachableError
from metadata.generated.schema.entity.services.connections.database.common.azureConfig import (
    AzureConfigurationSource,
)
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection as PostgresConnectionConfig,
)
from metadata.generated.schema.security.credentials.azureCredentials import (
    AzureCredentials,
)
from metadata.ingestion.source.database.postgres.connection import (
    POSTGRES_ERRORS,
    PostgresChecks,
    PostgresConnection,
)


def _azure_connection() -> PostgresConnectionConfig:
    return PostgresConnectionConfig(
        username="openmetadata_user",
        authType=AzureConfigurationSource(
            azureConfig=AzureCredentials(
                clientId="clientid",
                tenantId="tenantid",
                clientSecret="clientsecret",
                scopes="scope1,scope2",
            )
        ),
        hostPort="localhost:5432",
        database="openmetadata_db",
    )


def test_basic_auth_builds_expected_url():
    connection = PostgresConnectionConfig(
        username="openmetadata_user",
        authType=BasicAuth(password="openmetadata_password"),
        hostPort="localhost:5432",
        database="openmetadata_db",
    )
    engine = PostgresConnection(connection).client
    assert (
        engine.url.render_as_string(hide_password=False)
        == "postgresql+psycopg2://openmetadata_user:openmetadata_password@localhost:5432/openmetadata_db"
    )


def test_azure_ad_uses_token_as_password():
    connection = _azure_connection()
    with patch.object(
        ClientSecretCredential,
        "get_token",
        return_value=AccessToken(token="mocked_token", expires_on=100),
    ):
        engine = PostgresConnection(connection).client
    assert (
        engine.url.render_as_string(hide_password=False)
        == "postgresql+psycopg2://openmetadata_user:mocked_token@localhost:5432/openmetadata_db"
    )


def test_azure_ad_does_not_mutate_caller_connection():
    connection = _azure_connection()
    with patch.object(
        ClientSecretCredential,
        "get_token",
        return_value=AccessToken(token="mocked_token", expires_on=100),
    ):
        assert PostgresConnection(connection).client is not None
    assert isinstance(connection.authType, AzureConfigurationSource)


class _Psycopg2Error(Exception):
    """Mirror a psycopg2 DBAPI error.

    The message and (for query-execution errors only) the SQLSTATE on ``.pgcode``
    reproduce what psycopg2 actually raises - connect-phase failures carry no
    code, captured live against PostgreSQL 15.
    """

    def __init__(self, message: str = "", pgcode: str | None = None) -> None:
        super().__init__(message)
        self.pgcode = pgcode


class _SqlAlchemyError(Exception):
    """Mirror ``sqlalchemy.exc.DBAPIError``: wraps the driver error on ``.orig``."""

    def __init__(self, orig: Exception) -> None:
        super().__init__(str(orig))
        self.orig = orig


# Real first-line messages captured from psycopg2 against PostgreSQL 15.
_AUTH_FAILED_MSG = (
    'connection to server at "localhost" (::1), port 5432 failed: '
    'FATAL:  password authentication failed for user "postgres"'
)
_DB_NOT_FOUND_MSG = (
    'connection to server at "localhost" (::1), port 5432 failed: FATAL:  database "nope_db" does not exist'
)


def test_auth_failure_message_is_classified():
    error = _SqlAlchemyError(_Psycopg2Error(_AUTH_FAILED_MSG))
    assert POSTGRES_ERRORS.classify(error).title == "Authentication failed"


def test_database_not_found_message_is_classified():
    error = _SqlAlchemyError(_Psycopg2Error(_DB_NOT_FOUND_MSG))
    assert POSTGRES_ERRORS.classify(error).title == "Database not found"


def test_insufficient_privilege_sqlstate_is_classified():
    error = _SqlAlchemyError(_Psycopg2Error("permission denied for table secret_t", pgcode="42501"))
    assert POSTGRES_ERRORS.classify(error).title == "Insufficient privileges"


# Real GetQueries failure when the source is absent: the error text embeds the
# probe SQL, which references pg_catalog.pg_database - the case that must NOT be
# misread as "Database not found". Keyed on SQLSTATE 42P01, so it holds for any
# configured queryStatementSource, not just the default pg_stat_statements.
_MISSING_PGSS_MSG = (
    'relation "pg_stat_statements" does not exist\n[SQL: SELECT u.usename, d.datname '
    "FROM pg_stat_statements s JOIN pg_catalog.pg_database d ON s.dbid = d.oid LIMIT 1]"
)


def test_missing_query_history_source_is_classified():
    error = _SqlAlchemyError(_Psycopg2Error(_MISSING_PGSS_MSG, pgcode="42P01"))
    assert POSTGRES_ERRORS.classify(error).title == "Query history source not found"


def test_missing_query_history_source_is_not_read_as_database_not_found():
    # The probe SQL mentions pg_database; the diagnosis must be query-history, not db.
    error = _SqlAlchemyError(_Psycopg2Error(_MISSING_PGSS_MSG, pgcode="42P01"))
    assert POSTGRES_ERRORS.classify(error).title != "Database not found"


def test_missing_query_history_source_holds_for_a_custom_source_name():
    # queryStatementSource is configurable; a custom source missing must still be
    # diagnosed as a query-history problem, not left unclassified.
    error = _SqlAlchemyError(_Psycopg2Error('relation "my_query_log" does not exist', pgcode="42P01"))
    assert POSTGRES_ERRORS.classify(error).title == "Query history source not found"


def test_pg_hba_message_is_classified():
    error = Exception('FATAL: no pg_hba.conf entry for host "1.2.3.4", user "u", SSL off')
    assert POSTGRES_ERRORS.classify(error).title == "Connection not permitted by pg_hba.conf"


def test_network_errors_classify_through_including():
    error = NetworkUnreachableError("db:5432 is not reachable")
    error.__cause__ = ConnectionRefusedError(61, "Connection refused")
    assert POSTGRES_ERRORS.classify(error).title == "Connection refused"


def test_unknown_error_returns_no_diagnosis():
    error = _SqlAlchemyError(_Psycopg2Error("something unexpected", pgcode="99999"))
    assert POSTGRES_ERRORS.classify(error) is None


def test_checks_cover_exactly_the_seeded_steps():
    engine = create_engine("sqlite://", poolclass=StaticPool)
    checks = PostgresChecks(client=engine, query_statement_source=None)
    collected = collect_checks(checks)
    assert set(collected.keys()) == {
        DatabaseStep.CheckAccess,
        DatabaseStep.GetDatabases,
        DatabaseStep.GetSchemas,
        DatabaseStep.GetTables,
        DatabaseStep.GetViews,
        DatabaseStep.GetTags,
        DatabaseStep.GetQueries,
        DatabaseStep.GetColumnMetadata,
        DatabaseStep.GetTableComments,
        DatabaseStep.GetInformationSchemaColumns,
    }


def test_check_access_reports_unreachable_host_as_network_failure():
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    client = MagicMock()
    client.url.host = "127.0.0.1"
    client.url.port = port
    checks = PostgresChecks(client=client, query_statement_source=None)
    with pytest.raises(CheckError) as exc:
        checks.check_access()
    assert isinstance(exc.value.cause, NetworkUnreachableError)
    assert POSTGRES_ERRORS.classify(exc.value.cause).title == "Connection refused"


def test_query_statement_is_built_lazily_not_at_construction():
    # Regression: the version-probe query must run inside GetQueries (behind the
    # CheckAccess gate), never at checks() construction - otherwise an unreachable
    # host hangs on that eager connect instead of failing fast at the preflight.
    calls = []
    with patch(
        "metadata.ingestion.source.database.postgres.connection.get_postgres_time_column_name",
        side_effect=lambda engine: calls.append(1) or "total_exec_time",
    ):
        engine = create_engine("sqlite://", poolclass=StaticPool)
        PostgresChecks(client=engine, query_statement_source=None)
        assert calls == []
