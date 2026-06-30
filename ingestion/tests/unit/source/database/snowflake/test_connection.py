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
"""Unit tests for Snowflake test-connection checks and error classification.

The error-pack matchers (errnos and message tokens) are hypotheses drawn from the
snowflake-connector-python docs/source; they are validated against a live account
in VALIDATION.md. These tests pin the wiring (steps resolve to checks, the network
pack is folded in, nothing connects at construction) and the intended mapping.
"""

from unittest.mock import MagicMock, patch

import pytest

from metadata.core.connections.test_connection.check import CheckError, collect_checks
from metadata.core.connections.test_connection.checks.database import DatabaseStep
from metadata.core.connections.test_connection.network import NetworkUnreachableError
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection as SnowflakeConnectionConfig,
)
from metadata.ingestion.source.database.snowflake.connection import (
    SNOWFLAKE_ERRORS,
    SNOWFLAKE_PORT,
    SnowflakeChecks,
)


def _config(**overrides) -> SnowflakeConnectionConfig:
    base = {"username": "user", "account": "ue18849.us-east-2.aws", "warehouse": "wh"}
    base.update(overrides)
    return SnowflakeConnectionConfig(**base)


class _SnowflakeError(Exception):
    """Mirror a snowflake.connector error: the code lives on ``.errno`` (not in
    ``args[0]`` as for PyMySQL), the message is the first arg."""

    def __init__(self, message: str = "", errno: int | None = None) -> None:
        super().__init__(message)
        self.errno = errno


class _SqlAlchemyError(Exception):
    """Mirror ``sqlalchemy.exc.DBAPIError``: wraps the driver error on ``.orig``."""

    def __init__(self, orig: Exception) -> None:
        super().__init__(str(orig))
        self.orig = orig


def test_auth_failure_errno_is_classified():
    error = _SqlAlchemyError(_SnowflakeError("250001 (08001): Failed to connect to DB", errno=250001))
    assert SNOWFLAKE_ERRORS.classify(error).title == "Authentication failed"


def test_auth_failure_message_is_classified():
    error = _SqlAlchemyError(_SnowflakeError("Incorrect username or password were specified."))
    assert SNOWFLAKE_ERRORS.classify(error).title == "Authentication failed"


def test_account_usage_denied_is_classified():
    error = _SqlAlchemyError(
        _SnowflakeError(
            "Object 'SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY' does not exist or not authorized.",
            errno=2003,
        )
    )
    assert SNOWFLAKE_ERRORS.classify(error).title == "Account usage not accessible"


def test_account_usage_denied_wins_over_generic_object_not_found():
    # The same message also matches the generic "does not exist or not authorized"
    # rule; the account_usage rule is ordered first so the sharper diagnosis wins.
    error = _SnowflakeError(
        "SQL compilation error: Object 'SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY' does not exist or not authorized.",
        errno=2003,
    )
    assert SNOWFLAKE_ERRORS.classify(error).title != "Object not found"


def test_insufficient_privileges_is_classified():
    error = _SnowflakeError("SQL access control error: Insufficient privileges to operate on schema 'PUBLIC'")
    assert SNOWFLAKE_ERRORS.classify(error).title == "Insufficient privileges"


def test_object_not_found_errno_is_classified():
    error = _SqlAlchemyError(_SnowflakeError("Database 'NOPE' does not exist or not authorized.", errno=2003))
    assert SNOWFLAKE_ERRORS.classify(error).title == "Object not found"


def test_no_active_warehouse_is_classified():
    error = _SnowflakeError("No active warehouse selected in the current session.")
    assert SNOWFLAKE_ERRORS.classify(error).title == "No active warehouse"


def test_unknown_error_returns_no_diagnosis():
    error = _SqlAlchemyError(_SnowflakeError("something unexpected", errno=99999))
    assert SNOWFLAKE_ERRORS.classify(error) is None


def test_network_errors_classify_through_including():
    error = NetworkUnreachableError("acc.snowflakecomputing.com:443 is not reachable")
    error.__cause__ = TimeoutError("timed out")
    assert SNOWFLAKE_ERRORS.classify(error).title == "Connection timed out"


def test_checks_cover_exactly_the_wired_steps():
    checks = SnowflakeChecks(client=MagicMock(), service_connection=_config())
    collected = collect_checks(checks)
    assert set(collected.keys()) == {
        DatabaseStep.CheckAccess,
        DatabaseStep.GetDatabases,
        DatabaseStep.GetSchemas,
        DatabaseStep.GetTables,
        DatabaseStep.GetViews,
        DatabaseStep.GetStreams,
        DatabaseStep.GetTags,
        DatabaseStep.GetQueries,
        DatabaseStep.GetAccessHistory,
    }


def test_get_access_history_is_wired():
    # ACCESS_HISTORY is the default lineage source; its probe is the GetAccessHistory step.
    checks = SnowflakeChecks(client=MagicMock(), service_connection=_config())
    assert DatabaseStep.GetAccessHistory in collect_checks(checks)


def test_construction_touches_no_network():
    # Regression for gotcha #2: building the provider must not connect or resolve a
    # database - that would run before the gate and bypass the preflight.
    client = MagicMock()
    SnowflakeChecks(client=client, service_connection=_config())
    client.connect.assert_not_called()
    client.execute.assert_not_called()


def test_check_access_probes_account_host_and_reports_network_failure():
    # check_access -> tcp_probe(<account>.snowflakecomputing.com, 443); a probe
    # failure is wrapped as a CheckError whose cause classifies via the network
    # pack. tcp_probe is stubbed so the test is deterministic and fast.
    checks = SnowflakeChecks(client=MagicMock(), service_connection=_config(account="acc"))
    probe_error = NetworkUnreachableError("acc.snowflakecomputing.com:443 is not reachable")
    probe_error.__cause__ = TimeoutError("timed out")
    with (
        patch(
            "metadata.ingestion.source.database.snowflake.connection.tcp_probe",
            side_effect=probe_error,
        ) as mock_probe,
        pytest.raises(CheckError) as exc,
    ):
        checks.check_access()
    mock_probe.assert_called_once_with("acc.snowflakecomputing.com", SNOWFLAKE_PORT)
    assert exc.value.cause is probe_error
    assert SNOWFLAKE_ERRORS.classify(exc.value.cause).title == "Connection timed out"


def test_account_usage_queries_built_lazily_not_at_construction():
    # The account_usage statements must be formatted inside their checks (behind
    # the gate), never at construction; constructing must not read the engine.
    client = MagicMock()
    checks = SnowflakeChecks(client=client, service_connection=_config(account="acc"))
    assert checks._engine_wrapper.database_name is None
    client.connect.assert_not_called()
