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
"""Unit tests for the MSSQL BaseConnection wiring.

URL building (including the pyodbc delegation to azuresql) is covered in
tests/unit/test_source_url.py and tests/unit/test_source_connection.py.
"""

import socket
from pathlib import Path
from unittest.mock import MagicMock, patch

import pyodbc
import pytest
from pytds.tds_base import Message
from pytds.tds_session import _TdsSession
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError as SqlAlchemyOperationalError
from sqlalchemy.pool import StaticPool

from metadata.core.connections.lifetime import Borrowed
from metadata.core.connections.test_connection import Matchers, collect_checks
from metadata.core.connections.test_connection.checks.database import DEFAULT_SAMPLE_ROWS, DatabaseStep
from metadata.core.connections.test_connection.runner import TestConnectionRunner
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection as MssqlConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlScheme,
)
from metadata.generated.schema.entity.services.connections.testConnectionDefinition import (
    TestConnectionDefinition,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.mssql.connection import (
    MSSQL_ERRORS,
    MssqlChecks,
    MssqlConnection,
    _mssql_number,
    get_connection_url,
)
from metadata.ingestion.source.database.mssql.queries import (
    MSSQL_GET_CURRENT_DATABASE,
    MSSQL_GET_DATABASE,
)

CONNECTION_MODULE = "metadata.ingestion.source.database.mssql.connection"


def _config(scheme: MssqlScheme = MssqlScheme.mssql_pytds) -> MssqlConnectionConfig:
    return MssqlConnectionConfig(
        scheme=scheme,
        username="user",
        password="pass",
        hostPort="myhost:1433",
        database="mydb",
    )


def test_mssql_connection_is_base_connection():
    assert issubclass(MssqlConnection, BaseConnection)


def test_get_client_uses_the_module_url_builder():
    with patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_connection:
        _ = MssqlConnection(_config()).client
    assert mock_connection.call_args.kwargs["get_connection_url_fn"].__name__ == "get_connection_url"


def test_pyodbc_scheme_delegates_to_azuresql_url_builder():
    with patch(f"{CONNECTION_MODULE}.get_pyodbc_connection_url", return_value="delegated") as mock_pyodbc:
        result = get_connection_url(_config(scheme=MssqlScheme.mssql_pyodbc))
    mock_pyodbc.assert_called_once()
    assert result == "delegated"


def test_non_pyodbc_scheme_uses_common_url_builder():
    url = get_connection_url(_config(scheme=MssqlScheme.mssql_pytds))
    assert url.startswith("mssql+pytds://")


def _checks() -> MssqlChecks:
    return MssqlChecks(db=Borrowed.of(MagicMock()), get_databases_statement="SELECT 1")


def test_every_definition_step_resolves_to_a_check():
    collected = collect_checks(_checks())
    assert set(collected) == {
        DatabaseStep.CheckAccess,
        DatabaseStep.GetDatabases,
        DatabaseStep.GetSchemas,
        DatabaseStep.GetTables,
        DatabaseStep.GetViews,
        DatabaseStep.GetQueries,
    }


def test_close_disposes_the_engine():
    with patch(f"{CONNECTION_MODULE}.create_generic_db_connection"):
        connection = MssqlConnection(_config())
        engine = connection.client
        connection.close()
    engine.dispose.assert_called_once()


def test_building_checks_does_not_touch_the_network():
    with patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_engine:
        provider = MssqlConnection(_config()).checks()
    engine = mock_engine.return_value
    engine.connect.assert_not_called()
    engine.exec_driver_sql.assert_not_called()
    assert isinstance(provider, MssqlChecks)


def test_get_databases_statement_uses_current_db_when_not_ingest_all():
    config = _config()
    config.ingestAllDatabases = False
    handler = MssqlConnection(config)
    handler._client = MagicMock()
    assert handler._get_databases_statement() == MSSQL_GET_CURRENT_DATABASE


def test_get_databases_statement_uses_all_dbs_when_ingest_all():
    config = _config()
    config.ingestAllDatabases = True
    handler = MssqlConnection(config)
    handler._client = MagicMock()
    assert handler._get_databases_statement() == MSSQL_GET_DATABASE


# ── Driver error fixtures ────────────────────────────────────────────────────


def _message(number: int, text: str) -> Message:
    return {
        "marker": 0xAA,
        "msgno": number,
        "state": 1,
        "severity": 16,
        "sql_state": None,
        "priv_msg_type": 0,
        "message": text,
        "server": "sql1",
        "proc_name": "",
        "line_number": 1,
    }


class _Session:
    """The only attribute raise_db_exception touches."""

    def __init__(self, messages: list[Message]) -> None:
        self.messages = messages


def _pytds_error(*messages: tuple[int, str]) -> Exception:
    """The error pytds raises for a sequence of server messages.

    Goes through the driver's own _TdsSession.raise_db_exception, where the
    number/text asymmetry lives, so it cannot drift from it.
    """
    session = _Session([_message(number, text) for number, text in messages])
    try:
        _TdsSession.raise_db_exception(session)
    except Exception as raised:
        return raised
    raise AssertionError("raise_db_exception did not raise")


def _pymssql_error(number: int, message: str) -> Exception:
    """pymssql's DBAPI shape: args[0] is the (number, message) tuple.

    Hand-rolled - pymssql is in its own extra, not installed. Shape from v2.3.9
    _pymssql.pyx, connect: `raise OperationalError(e.args[0])`.
    """
    return Exception((number, message))


def _pyodbc_error(sqlstate: str, message: str) -> Exception:
    """pyodbc's shape: ``args`` is ``(sqlstate, message)`` (src/errors.cpp, GetError).
    The number appears only inside the message text."""
    return pyodbc.ProgrammingError(sqlstate, f"[{sqlstate}] [Microsoft][ODBC Driver 18 for SQL Server]{message}")


def _wrapped(orig: Exception) -> Exception:
    """The driver error as SQLAlchemy re-raises it.

    ``__cause__`` is the driver error, which is also what ``.orig`` holds - verified
    on both the connect and execute paths, they are the same object.
    """
    error = SqlAlchemyOperationalError("SELECT 1", {}, orig)
    error.__cause__ = orig
    return error


# The message sequences SQL Server really sends, captured from a live server
# (Azure SQL Edge, pytds). The pairs are the whole point: pytds joins every
# message's TEXT but keeps only the LAST message's NUMBER.
_MISSING_DATABASE = (
    (4060, 'Cannot open database "no_such_db" requested by the login. The login failed.'),
    (18456, "Login failed for user 'sa'."),
)
_BAD_PASSWORD = ((18456, "Login failed for user 'sa'."),)
_DENIED_SELECT = ((229, "The SELECT permission was denied on the object 'secret_t', database 'probe', schema 'dbo'."),)
_NO_VIEW_SERVER_STATE = (
    (300, "VIEW SERVER STATE permission was denied on object 'server', database 'master'."),
    (297, "The user does not have permission to perform this action."),
)


@pytest.mark.parametrize(
    ("messages", "expected_number"),
    [
        (_MISSING_DATABASE, 18456),  # NOT 4060 - the pair's last message wins
        (_BAD_PASSWORD, 18456),
        (_DENIED_SELECT, 229),
        (_NO_VIEW_SERVER_STATE, 297),  # NOT 300 - same reason
    ],
)
def test_pytds_reproduces_the_live_server_message_pairs(messages, expected_number):
    """Each expected_number was read off a live Azure SQL Edge through this driver.
    If pytds changes which message it takes the number from, this fails rather than
    the rules silently going dead."""
    assert _mssql_number(_pytds_error(*messages)) == expected_number


def test_matchers_errno_cannot_read_any_supported_driver():
    """Why this connector needs its own accessor: Matchers.errno wants an int at
    args[0]; pytds puts the message there, pymssql a tuple, pyodbc a SQLSTATE."""
    assert not Matchers.errno(18456)(_pytds_error(*_BAD_PASSWORD))
    assert not Matchers.errno(18456)(_pymssql_error(18456, "Login failed for user 'x'."))
    assert not Matchers.errno(4060)(_pyodbc_error("42000", "Cannot open database."))


def test_mssql_number_reads_each_driver_shape():
    assert _mssql_number(_pytds_error(*_BAD_PASSWORD)) == 18456
    assert _mssql_number(_pymssql_error(4060, "Cannot open database.")) == 4060
    assert _mssql_number(_wrapped(_pytds_error(*_DENIED_SELECT))) == 229
    # pyodbc carries no number anywhere the accessor can reach.
    assert _mssql_number(_pyodbc_error("42000", "Cannot open database. (4060)")) is None
    assert _mssql_number(Exception("no number here")) is None


def test_mssql_number_reads_through_sqlalchemys_cause():
    """SQLAlchemy chains the driver error onto __cause__, which is the same object
    it exposes as .orig - so walking the cause chain alone suffices."""
    driver_error = _pytds_error(*_DENIED_SELECT)
    wrapper = _wrapped(driver_error)
    assert wrapper.orig is wrapper.__cause__ is driver_error
    assert _mssql_number(wrapper) == 229


# SQL Server localizes message text but never the number, so a German message can
# only be diagnosed via the number. This is what proves a code is really bound.
@pytest.mark.parametrize(
    ("messages", "title"),
    [
        (((18456, "Fehler bei der Anmeldung für den Benutzer 'y'."),), "Authentication failed"),
        (((229, "Die SELECT-Berechtigung wurde für das Objekt 'x' verweigert."),), "Insufficient privileges"),
        (
            (
                (300, "Die VIEW SERVER STATE-Berechtigung wurde verweigert."),
                (297, "Der Benutzer hat keine Berechtigung zum Ausführen dieser Aktion."),
            ),
            "Insufficient privileges",
        ),
    ],
)
def test_error_numbers_classify_independently_of_message_text(messages, title):
    diagnosis = MSSQL_ERRORS.classify(_wrapped(_pytds_error(*messages)))
    assert diagnosis is not None, "unbound: no rule matched"
    assert diagnosis.title == title


def test_a_localized_missing_database_has_no_number_to_key_on():
    """The documented limitation, pinned so nobody re-adds a 4060 rule expecting it
    to fire. pytds reports the [4060, 18456] pair's number as 18456, so on a
    non-English server a missing database is diagnosed as an auth failure. English
    survives only via the "Cannot open database" text rule."""
    localized = (
        (4060, 'Die Datenbank "x" kann nicht geöffnet werden. Fehler bei der Anmeldung.'),
        (18456, "Fehler bei der Anmeldung für den Benutzer 'y'."),
    )
    error = _wrapped(_pytds_error(*localized))

    assert _mssql_number(error) == 18456
    assert MSSQL_ERRORS.classify(error).title == "Authentication failed"


def test_pymssql_tuple_shape_classifies_by_number():
    diagnosis = MSSQL_ERRORS.classify(_wrapped(_pymssql_error(18456, "Fehler bei der Anmeldung.")))
    assert diagnosis is not None
    assert diagnosis.title == "Authentication failed"


def test_pytds_login_failure_classifies_as_auth():
    diagnosis = MSSQL_ERRORS.classify(_wrapped(_pytds_error(*_BAD_PASSWORD)))
    assert diagnosis is not None
    assert diagnosis.title == "Authentication failed"


def test_pyodbc_login_failure_classifies_as_auth_on_message_text():
    # pyodbc exposes no number, so this rides the `Login failed` message rule.
    diagnosis = MSSQL_ERRORS.classify(_pyodbc_error("28000", "Login failed for user 'x'."))
    assert diagnosis is not None
    assert diagnosis.title == "Authentication failed"


def test_pytds_database_not_found_classifies():
    diagnosis = MSSQL_ERRORS.classify(_wrapped(_pytds_error(*_MISSING_DATABASE)))
    assert diagnosis is not None
    assert diagnosis.title == "Database not found or not accessible"


def test_pyodbc_cannot_open_database_classifies():
    diagnosis = MSSQL_ERRORS.classify(_pyodbc_error("42000", 'Cannot open database "x" requested by the login.'))
    assert diagnosis is not None
    assert diagnosis.title == "Database not found or not accessible"


def test_cannot_open_database_wins_over_login_failed():
    """4060's text ends "The login failed." and pytds appends "Login failed for
    user ..." - and the number is 18456. Both signals point at auth; only rule order
    saves this case."""
    error = _wrapped(_pytds_error(*_MISSING_DATABASE))

    assert "Login failed for user" in str(error)
    assert _mssql_number(error) == 18456
    assert MSSQL_ERRORS.classify(error).title == "Database not found or not accessible"


def test_pytds_permission_denied_classifies():
    error = _wrapped(_pytds_error(*_DENIED_SELECT))
    diagnosis = MSSQL_ERRORS.classify(error)
    assert diagnosis is not None
    assert diagnosis.title == "Insufficient privileges"


def test_pyodbc_permission_denied_classifies():
    diagnosis = MSSQL_ERRORS.classify(_pyodbc_error("42000", "The SELECT permission was denied on the object 'x'."))
    assert diagnosis is not None
    assert diagnosis.title == "Insufficient privileges"


def test_statement_permission_denied_is_not_diagnosed():
    """262 is a statement permission (CREATE DATABASE / TABLE / SHOWPLAN); these
    checks only SELECT. Its text says "permission denied", not "permission was
    denied", so the message rule misses it too."""
    error = _wrapped(_pytds_error((262, "CREATE DATABASE permission denied in database 'master'.")))
    assert MSSQL_ERRORS.classify(error) is None


def test_network_pack_is_folded_in():
    diagnosis = MSSQL_ERRORS.classify(socket.gaierror("Name or service not known"))
    assert diagnosis is not None
    assert diagnosis.title == "Host could not be resolved"


def test_unknown_error_is_not_classified():
    assert MSSQL_ERRORS.classify(Exception("something unexpected")) is None


# ── API level: TestConnectionRunner.run() -> TestConnectionResult ────────────
#
# The product surface. Everything above asserts on the pack in isolation; these
# drive the runner end to end against an engine that raises a real pytds error and
# assert on the TestConnectionResult the backend and UI actually consume.


MSSQL_DEFINITION_JSON = (
    Path(__file__).parents[6] / "openmetadata-service/src/main/resources/json/data/testConnections/database/mssql.json"
)


def _mssql_definition() -> TestConnectionDefinition:
    """The MSSQL definition the server seeds, loaded from the resource itself.

    Read rather than transcribed so step order, gate category and mandatory flags
    cannot drift from what production runs.
    """
    return TestConnectionDefinition.model_validate_json(MSSQL_DEFINITION_JSON.read_text())


def _run_against(engine) -> TestConnectionResult:
    """Drive the runner as BaseConnection.test_connection does. tcp_probe is stubbed
    so the gate's preflight passes and the test reaches the driver error."""
    metadata = MagicMock()
    metadata.get_by_name.return_value = _mssql_definition()
    checks = MssqlChecks(db=Borrowed.of(engine), get_databases_statement="SELECT 1")
    with patch("metadata.core.connections.test_connection.network.tcp_probe"):
        return TestConnectionRunner(checks, "Mssql", timeout_seconds=None).run(metadata)


def _engine_failing_with(error: Exception) -> Engine:
    """A real mssql+pytds Engine whose DBAPI connect raises `error`, so SQLAlchemy
    does the wrapping and the classifier sees the production shape."""

    def connect_raises():
        raise error

    return create_engine("mssql+pytds://user:pass@sql1.example.com:1433/mydb", creator=connect_raises)


def test_bad_login_fails_the_whole_test_with_an_auth_diagnosis():
    result = _run_against(_engine_failing_with(_pytds_error(*_BAD_PASSWORD)))

    assert result.status.value == "Failed"
    gate = result.steps[0]
    assert gate.name == "CheckAccess"
    assert gate.passed is False
    assert gate.status.value == "Failed"
    assert gate.diagnosis.title == "Authentication failed"
    assert gate.diagnosis.remediation


def test_a_failed_gate_short_circuits_every_later_step():
    result = _run_against(_engine_failing_with(_pytds_error(*_BAD_PASSWORD)))

    later = result.steps[1:]
    assert [step.status.value for step in later] == ["Skipped"] * 5
    assert {step.skipReason.value for step in later} == {"ConnectionNotEstablished"}


def test_missing_database_is_reported_as_a_database_problem_not_an_auth_one():
    """Both of 4060's signals point at auth - the joined text ends "Login failed for
    user ..." and the number is 18456 - so only rule order gets this right."""
    result = _run_against(_engine_failing_with(_pytds_error(*_MISSING_DATABASE)))

    assert result.status.value == "Failed"
    assert result.steps[0].diagnosis.title == "Database not found or not accessible"


def test_a_localized_permission_denial_is_diagnosed_at_the_api_level():
    """End-to-end proof a number, not the English text, can drive the diagnosis."""
    localized = (
        (300, "Die VIEW SERVER STATE-Berechtigung wurde verweigert."),
        (297, "Der Benutzer hat keine Berechtigung zum Ausführen dieser Aktion."),
    )
    result = _run_against(_engine_failing_with(_pytds_error(*localized)))

    assert result.steps[0].diagnosis.title == "Insufficient privileges"


def test_an_unclassified_failure_still_reports_its_raw_error_log():
    result = _run_against(_engine_failing_with(RuntimeError("something we have never seen")))

    gate = result.steps[0]
    assert gate.passed is False
    assert gate.diagnosis is None
    assert "something we have never seen" in gate.errorLog


def _engine_returning(rows: int) -> Engine:
    """A real engine whose probe statement returns ``rows`` rows."""
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    with engine.connect() as connection:
        connection.exec_driver_sql("CREATE TABLE probe (name TEXT)")
        for index in range(rows):
            connection.exec_driver_sql(f"INSERT INTO probe VALUES ('db{index}')")
        connection.commit()
    return engine


def _databases_summary(rows: int) -> str:
    checks = MssqlChecks(db=Borrowed.of(_engine_returning(rows)), get_databases_statement="SELECT name FROM probe")
    return collect_checks(checks)[DatabaseStep.GetDatabases]().summary


def test_get_databases_counts_the_databases_it_found():
    assert _databases_summary(3) == "3 databases enumerated"


def test_get_databases_reports_a_floor_when_the_sample_is_capped():
    assert _databases_summary(DEFAULT_SAMPLE_ROWS) == f"{DEFAULT_SAMPLE_ROWS}+ databases enumerated"
