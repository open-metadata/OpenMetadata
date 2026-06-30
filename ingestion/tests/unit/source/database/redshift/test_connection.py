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
"""Unit tests for the Redshift BaseConnection wiring and test-connection checks.

The IAM/basic URL building and credential fetching are covered in
tests/unit/topology/database/test_redshift_connection.py.
"""

from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from metadata.core.connections.test_connection.check import CheckError, collect_checks
from metadata.core.connections.test_connection.checks.database import (
    DEFAULT_SAMPLE_ROWS,
    DatabaseStep,
)
from metadata.core.connections.test_connection.network import NetworkUnreachableError
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.redshiftConnection import (
    RedshiftConnection as RedshiftConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.redshift.connection import (
    REDSHIFT_ERRORS,
    RedshiftChecks,
    RedshiftConnection,
    _summarize_databases,
)

CONNECTION_MODULE = "metadata.ingestion.source.database.redshift.connection"


def _config() -> RedshiftConnectionConfig:
    return RedshiftConnectionConfig(
        hostPort="my-cluster.abc123.us-east-1.redshift.amazonaws.com:5439",
        username="admin",
        authType=BasicAuth(password="secret"),
        database="mydb",
    )


def test_redshift_connection_is_base_connection():
    assert issubclass(RedshiftConnection, BaseConnection)


def test_get_client_uses_the_redshift_url_builder():
    with patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_connection:
        _ = RedshiftConnection(_config()).client
    assert mock_connection.call_args.kwargs["get_connection_url_fn"].__name__ == "get_redshift_connection_url"


def test_close_disposes_the_engine_pool():
    # The old test_connection called kill_active_connections(engine); the framework
    # path relies on close() unwinding _on_close teardowns, so _get_client must
    # register engine.dispose or the QueuePool leaks idle connections.
    engine = MagicMock()
    with patch(f"{CONNECTION_MODULE}.create_generic_db_connection", return_value=engine):
        connection = RedshiftConnection(_config())
        assert connection.client is engine
        connection.close()
    engine.dispose.assert_called_once_with()


class _Psycopg2Error(Exception):
    """Mirror a psycopg2 DBAPI error.

    The Redshift dialect rides on psycopg2: the message and (for query-execution
    errors only) the SQLSTATE on ``.pgcode`` reproduce what the driver raises -
    connect-phase failures carry no code.
    """

    def __init__(self, message: str = "", pgcode: str | None = None) -> None:
        super().__init__(message)
        self.pgcode = pgcode


class _SqlAlchemyError(Exception):
    """Mirror ``sqlalchemy.exc.DBAPIError``: wraps the driver error on ``.orig``."""

    def __init__(self, orig: Exception) -> None:
        super().__init__(str(orig))
        self.orig = orig


_AUTH_FAILED_MSG = (
    'connection to server at "my-cluster" port 5439 failed: FATAL:  password authentication failed for user "admin"'
)
_DB_NOT_FOUND_MSG = 'connection to server at "my-cluster" port 5439 failed: FATAL:  database "nope_db" does not exist'


def test_auth_failure_message_is_classified():
    error = _SqlAlchemyError(_Psycopg2Error(_AUTH_FAILED_MSG))
    assert REDSHIFT_ERRORS.classify(error).title == "Authentication failed"


def test_auth_failure_sqlstate_is_classified():
    error = _SqlAlchemyError(_Psycopg2Error("authorization not valid", pgcode="28000"))
    assert REDSHIFT_ERRORS.classify(error).title == "Authentication failed"


def test_database_not_found_message_is_classified():
    error = _SqlAlchemyError(_Psycopg2Error(_DB_NOT_FOUND_MSG))
    assert REDSHIFT_ERRORS.classify(error).title == "Database not found"


def test_insufficient_privilege_sqlstate_is_classified():
    error = _SqlAlchemyError(_Psycopg2Error("permission denied for table secret_t", pgcode="42501"))
    assert REDSHIFT_ERRORS.classify(error).title == "Insufficient privileges"


def test_missing_query_history_source_is_classified():
    # An absent query-history view raises undefined_table (42P01) from the probe;
    # keyed on SQLSTATE, so it holds whether the deployment is Provisioned or Serverless.
    error = _SqlAlchemyError(_Psycopg2Error('relation "stl_query" does not exist', pgcode="42P01"))
    assert REDSHIFT_ERRORS.classify(error).title == "Query history source not found"


def test_missing_query_history_source_is_not_read_as_database_not_found():
    error = _SqlAlchemyError(_Psycopg2Error('relation "stl_query" does not exist', pgcode="42P01"))
    assert REDSHIFT_ERRORS.classify(error).title != "Database not found"


def test_missing_query_privilege_is_classified():
    # has_table_privilege returns False rather than raising; the GetQueries check
    # turns that into a SourceConnectionException whose text the pack classifies.
    error = Exception("Missing SELECT privilege on the Redshift stl query-history views - (True, False)")
    assert REDSHIFT_ERRORS.classify(error).title == "Query history not accessible"


def test_network_errors_classify_through_including():
    error = NetworkUnreachableError("cluster:5439 is not reachable")
    error.__cause__ = ConnectionRefusedError(61, "Connection refused")
    assert REDSHIFT_ERRORS.classify(error).title == "Connection refused"


def test_unknown_error_returns_no_diagnosis():
    error = _SqlAlchemyError(_Psycopg2Error("something unexpected", pgcode="99999"))
    assert REDSHIFT_ERRORS.classify(error) is None


def test_database_summary_reports_exact_count_under_the_sample_cap():
    assert _summarize_databases(["dev", "analytics"]) == "2 databases reachable"


def test_database_summary_flags_a_capped_count_with_a_plus():
    # run_sql fetches at most DEFAULT_SAMPLE_ROWS, so a saturated sample must read
    # as "at least N", never as an exact total.
    capped = list(range(DEFAULT_SAMPLE_ROWS))
    assert _summarize_databases(capped) == f"{DEFAULT_SAMPLE_ROWS}+ databases reachable"


def test_checks_cover_exactly_the_seeded_steps():
    engine = create_engine("sqlite://", poolclass=StaticPool)
    checks = RedshiftChecks(client=engine)
    collected = collect_checks(checks)
    assert set(collected.keys()) == {
        DatabaseStep.CheckAccess,
        DatabaseStep.GetDatabases,
        DatabaseStep.GetSchemas,
        DatabaseStep.GetTables,
        DatabaseStep.GetViews,
        DatabaseStep.GetQueries,
    }


def test_check_access_reports_unreachable_host_as_network_failure():
    client = MagicMock()
    client.url.host = "cluster.invalid"
    client.url.port = 5439
    checks = RedshiftChecks(client=client)
    probe_error = NetworkUnreachableError("cluster.invalid:5439 is not reachable")
    probe_error.__cause__ = ConnectionRefusedError(61, "Connection refused")
    with (
        patch(
            "metadata.core.connections.test_connection.checks.database.tcp_probe",
            side_effect=probe_error,
        ) as mock_probe,
        pytest.raises(CheckError) as exc,
    ):
        checks.check_access()
    mock_probe.assert_called_once_with("cluster.invalid", 5439)
    assert exc.value.cause is probe_error
    assert REDSHIFT_ERRORS.classify(exc.value.cause).title == "Connection refused"


def test_instance_type_probe_is_run_lazily_not_at_construction():
    # Regression: the instance-type probe must run inside GetQueries (behind the
    # CheckAccess gate), never at checks() construction - otherwise an unreachable
    # host hangs on that eager connect instead of failing fast at the preflight.
    calls = []
    with patch(
        f"{CONNECTION_MODULE}.get_redshift_instance_type",
        side_effect=lambda engine: calls.append(1),
    ):
        engine = create_engine("sqlite://", poolclass=StaticPool)
        RedshiftChecks(client=engine)
        assert calls == []
