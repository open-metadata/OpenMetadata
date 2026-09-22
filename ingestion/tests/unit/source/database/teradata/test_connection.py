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
"""Unit tests for Teradata connection handling (URL building + checks)."""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.pool import StaticPool

from metadata.core.connections.lifetime import Borrowed
from metadata.core.connections.test_connection.check import CheckError, collect_checks
from metadata.core.connections.test_connection.checks.database import (
    DEFAULT_SAMPLE_ROWS,
    DatabaseStep,
)
from metadata.core.connections.test_connection.network import NetworkUnreachableError
from metadata.core.connections.test_connection.runner import TestConnectionRunner
from metadata.generated.schema.entity.services.connections.database.teradataConnection import (
    TeradataConnection as TeradataConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.teradataConnection import (
    TeradataScheme,
)
from metadata.generated.schema.entity.services.connections.testConnectionDefinition import (
    TestConnectionDefinition,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.teradata.connection import (
    TERADATA_DEFAULT_PORT,
    TERADATA_ERRORS,
    TeradataChecks,
    TeradataConnection,
)

TERADATA_DEFINITION_JSON = (
    Path(__file__).parents[6]
    / "openmetadata-service/src/main/resources/json/data/testConnections/database/teradata.json"
)


def test_teradata_connection_is_base_connection():
    assert issubclass(TeradataConnection, BaseConnection)


def test_get_connection_url_with_credentials_and_defaults():
    connection = TeradataConnectionConfig(
        scheme=TeradataScheme.teradatasql,
        username="openmetadata_user",
        password="openmetadata_password",
        hostPort="localhost:1025",
    )
    assert (
        TeradataConnection.get_connection_url(connection) == "teradatasql://localhost:1025/?user=openmetadata_user"
        "&password=openmetadata_password&logmech=TD2&tmode=DEFAULT"
    )


class _TeradatasqlError(Exception):
    """Stands in for ``teradatasql.OperationalError``, carrying a real driver message.

    teradatasql exposes no ``.errno``/``.sqlstate``: the codes live in the message,
    in the shape captured from a live 20.0 system. The error pack reads that text
    and nothing else, so the exception's own type and DBAPI lineage are immaterial
    - which keeps this module importable, and every classifier test runnable,
    without the optional ``teradata`` extra installed.
    """


class _SqlAlchemyError(Exception):
    """Mirror ``sqlalchemy.exc.DBAPIError``: wraps the driver error on ``.orig``."""

    def __init__(self, orig: Exception) -> None:
        super().__init__(str(orig))
        self.orig = orig


def _teradata_error(code: int, sqlstate: str, text: str) -> _SqlAlchemyError:
    return _SqlAlchemyError(
        _TeradatasqlError(
            f"[Version 20.0.0.65] [Session 1038] [Teradata Database] [Error {code}] [SQLState {sqlstate}] {text}"
        )
    )


# The exact failure from the bug report, verbatim.
_BAD_CREDENTIALS = (8017, "28000", "The UserId, Password or Account is invalid.")
_DATABASE_NOT_FOUND = (3802, "42S02", "Database 'nope_db' does not exist.")
_OBJECT_NOT_FOUND = (3807, "42S02", "Object 'nope_tbl' does not exist.")
_NO_PRIVILEGE = (3523, "42000", "The user does not have SELECT access to dbc.tablesvx.")
# Captured from a live 20.0 system against an unresolvable hostname.
_HOSTNAME_LOOKUP_FAILED = (
    493,
    "08000",
    "Hostname lookup failed for testenv-vsigiyl08pyh5ml.env.trial.teradata.com",
)


def test_bad_credentials_are_classified_as_auth():
    assert TERADATA_ERRORS.classify(_teradata_error(*_BAD_CREDENTIALS)).title == "Authentication failed"


def test_an_auth_rejection_carrying_another_code_is_still_classified():
    # The rule keys on SQLState 28000, the SQL-standard "invalid authorization
    # specification" class, not on Error 8017. So any rejection Teradata files
    # under that class classifies without the pack having to enumerate its code.
    # The code below is illustrative - what the test pins is the class, which is
    # the only part of the pairing this rule depends on.
    error = _teradata_error(9999, "28000", "Some other authorization failure.")
    assert TERADATA_ERRORS.classify(error).title == "Authentication failed"


def test_database_not_found_is_classified():
    assert TERADATA_ERRORS.classify(_teradata_error(*_DATABASE_NOT_FOUND)).title == "Database not found"


def test_object_not_found_is_classified():
    assert TERADATA_ERRORS.classify(_teradata_error(*_OBJECT_NOT_FOUND)).title == "Object not found"


def test_missing_privilege_is_classified():
    assert TERADATA_ERRORS.classify(_teradata_error(*_NO_PRIVILEGE)).title == "Insufficient privileges"


def test_auth_outranks_a_code_rule_when_both_could_match():
    # A message carrying both an auth SQLState and a not-found code must read as
    # auth - rule order is the only thing that decides this.
    error = _teradata_error(3802, "28000", "The UserId, Password or Account is invalid.")
    assert TERADATA_ERRORS.classify(error).title == "Authentication failed"


def test_hostname_lookup_failure_is_classified():
    # teradatasql is a Go driver: it resolves the hostname itself and reports the
    # failure as its own OperationalError, with no Python socket exception in the
    # chain for NETWORK_ERRORS to match on. Only the code rule catches this.
    assert TERADATA_ERRORS.classify(_teradata_error(*_HOSTNAME_LOOKUP_FAILED)).title == "Host could not be resolved"


def test_another_connection_class_failure_falls_back_to_the_generic_diagnosis():
    error = _teradata_error(301, "08000", "Some other connection failure.")
    assert TERADATA_ERRORS.classify(error).title == "Cannot connect to the Teradata system"


def test_the_hostname_rule_outranks_the_generic_connection_rule():
    # Both match Error 493's message; the sharper wording has to win.
    assert TERADATA_ERRORS.classify(_teradata_error(*_HOSTNAME_LOOKUP_FAILED)).title != (
        "Cannot connect to the Teradata system"
    )


def test_network_errors_classify_through_including():
    error = NetworkUnreachableError("td.example.com:1025 is not reachable")
    error.__cause__ = ConnectionRefusedError(61, "Connection refused")
    assert TERADATA_ERRORS.classify(error).title == "Connection refused"


def test_an_unknown_error_gets_no_diagnosis():
    error = _teradata_error(9999, "HY000", "Something we have never seen.")
    assert TERADATA_ERRORS.classify(error) is None


def test_a_code_is_not_matched_as_a_bare_number_in_the_message():
    # 3802 appearing as data (a row count, an id) must not be read as a code -
    # the bracketed form is what the rules match on.
    error = _SqlAlchemyError(_TeradatasqlError("query returned 3802 rows"))
    assert TERADATA_ERRORS.classify(error) is None


def _checks(client=None) -> TeradataChecks:
    engine = client if client is not None else create_engine("sqlite://", poolclass=StaticPool)
    return TeradataChecks(db=Borrowed.of(engine))


def _teradata_definition() -> TestConnectionDefinition:
    """The definition the server seeds, loaded from the resource itself.

    Read rather than transcribed so step order, gate category and mandatory flags
    cannot drift from what production runs.
    """
    return TestConnectionDefinition.model_validate_json(TERADATA_DEFINITION_JSON.read_text())


def test_checks_cover_exactly_the_seeded_steps():
    seeded = {step.name for step in _teradata_definition().steps}
    assert {DatabaseStep(name).value for name in collect_checks(_checks())} == seeded


def test_the_seeded_gate_step_is_tagged_as_the_connection_gate():
    # The runner short-circuits on this category, and the UI splits the modal on
    # it. Without it a failed CheckAccess lets every later step open its own
    # connection, turning an unreachable host into a multi-minute hang.
    gate = _teradata_definition().steps[0]
    assert gate.name == DatabaseStep.CheckAccess
    assert gate.category.value == "ConnectionGate"


def test_the_new_get_databases_step_is_not_mandatory():
    # The step is new: the legacy handler passed the query but the definition had
    # no step for it, so it never ran. Making it mandatory would newly fail a
    # service whose user cannot read dbc.databasesvx but which works today.
    step = next(s for s in _teradata_definition().steps if s.name == DatabaseStep.GetDatabases)
    assert step.mandatory is False


def _engine_returning(rows: int) -> Engine:
    """An engine whose next statement returns ``rows`` rows, whatever the SQL.

    ``get_databases`` runs Teradata-specific SQL that sqlite cannot parse, so the
    statement is swapped for an equivalent sqlite one; what is under test is the
    summarizer wired to it, not the query text.
    """
    engine = create_engine("sqlite://", poolclass=StaticPool)
    with engine.connect() as connection:
        connection.exec_driver_sql("CREATE TABLE databasesvx (databasename TEXT)")
        for index in range(rows):
            connection.exec_driver_sql("INSERT INTO databasesvx VALUES (?)", (f"db_{index}",))
        connection.commit()
    return engine


def _get_databases_summary(rows: int) -> str:
    engine = _engine_returning(rows)
    with patch(
        "metadata.ingestion.source.database.teradata.connection.TERADATA_GET_DATABASE",
        "select databasename from databasesvx",
    ):
        return _checks(engine).get_databases().summary


def test_get_databases_summarises_what_it_found():
    assert _get_databases_summary(3) == "3 databases enumerated"


def test_get_databases_reports_an_empty_result_without_failing():
    assert _get_databases_summary(0) == "no databases enumerated"


def test_get_databases_marks_the_sample_cap_rather_than_implying_an_exact_count():
    # run_sql fetches at most DEFAULT_SAMPLE_ROWS, so a full page means "at least
    # this many", not "exactly this many".
    assert _get_databases_summary(DEFAULT_SAMPLE_ROWS + 5) == f"{DEFAULT_SAMPLE_ROWS}+ databases enumerated"


def _engine_failing_with(error: Exception) -> Engine:
    """An Engine whose connect raises ``error``, so the runner sees a failing gate.

    The dialect is incidental: run_sql wraps whatever connect raises into a
    CheckError, and the assertions are on the resulting step result, not on how
    SQLAlchemy wrapped the cause.
    """

    def connect_raises():
        raise error

    return create_engine("sqlite://", poolclass=StaticPool, creator=connect_raises)


def _run_against(engine: Engine) -> TestConnectionResult:
    """Drive the runner as BaseConnection.test_connection does. tcp_probe is stubbed
    so the gate's preflight passes and the test reaches the driver error."""
    metadata = MagicMock()
    metadata.get_by_name.return_value = _teradata_definition()
    with patch("metadata.core.connections.test_connection.network.tcp_probe"):
        return TestConnectionRunner(_checks(engine), "Teradata", timeout_seconds=None).run(metadata)


def test_bad_credentials_fail_the_whole_test_with_an_auth_diagnosis():
    result = _run_against(
        _engine_failing_with(
            _TeradatasqlError(
                "[Version 20.0.0.65] [Session 1038] [Teradata Database] [Error 8017] "
                "[SQLState 28000] The UserId, Password or Account is invalid."
            )
        )
    )

    assert result.status.value == "Failed"
    gate = result.steps[0]
    assert gate.name == "CheckAccess"
    assert gate.passed is False
    assert gate.diagnosis.title == "Authentication failed"
    assert gate.diagnosis.remediation


def test_a_failed_gate_short_circuits_every_later_step():
    result = _run_against(_engine_failing_with(_TeradatasqlError("[Error 8017] [SQLState 28000] invalid")))

    later = result.steps[1:]
    assert [step.status.value for step in later] == ["Skipped"] * 4
    assert {step.skipReason.value for step in later} == {"ConnectionNotEstablished"}


def test_an_unclassified_failure_still_reports_its_raw_error_log():
    result = _run_against(_engine_failing_with(RuntimeError("something we have never seen")))

    gate = result.steps[0]
    assert gate.passed is False
    assert gate.diagnosis is None
    assert "something we have never seen" in gate.errorLog


def _probe_target(url_host: str, url_port: int | None) -> tuple[str, int]:
    """The host:port check_access actually probes for a given engine URL.

    The stubbed probe raises, so the check stops there rather than going on to
    run SELECT 1 against an engine that only exists to carry a URL.
    """
    client = MagicMock()
    client.url.host = url_host
    client.url.port = url_port
    with (
        patch(
            "metadata.ingestion.source.database.teradata.connection.probe_or_fail",
            side_effect=RuntimeError("probe reached"),
        ) as mock_probe,
        pytest.raises(RuntimeError),
    ):
        _checks(client).check_access()
    return mock_probe.call_args.args


def test_the_preflight_uses_the_port_from_host_port_when_one_is_given():
    assert _probe_target("td.example.com", 1125) == ("td.example.com", 1125)


def test_the_preflight_falls_back_to_teradatas_default_port():
    # hostPort is commonly a bare hostname. The shared ping() skips the preflight
    # entirely in that case, which let a DNS failure reach the Go driver and come
    # back undiagnosable - so the probe defaults to the port the driver dials.
    assert _probe_target("td.example.com", None) == ("td.example.com", TERADATA_DEFAULT_PORT)


def test_check_access_reports_an_unreachable_host_as_a_network_failure():
    # Prove the wiring: check_access -> ping -> _preflight raises whatever
    # tcp_probe raises, wrapped as a CheckError whose cause classifies as a
    # network failure. tcp_probe is stubbed so no real socket is opened.
    client = MagicMock()
    client.url.host = "td.invalid"
    client.url.port = 1025
    probe_error = NetworkUnreachableError("td.invalid:1025 is not reachable")
    probe_error.__cause__ = ConnectionRefusedError(61, "Connection refused")
    with (
        patch(
            "metadata.core.connections.test_connection.network.tcp_probe",
            side_effect=probe_error,
        ) as mock_probe,
        pytest.raises(CheckError) as exc,
    ):
        _checks(client).check_access()
    mock_probe.assert_called_once_with("td.invalid", 1025)
    assert TERADATA_ERRORS.classify(exc.value.cause).title == "Connection refused"
