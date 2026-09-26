#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Offline persisted observations exercise the generic workflow boundary."""

import sys

import pytest

from ..runtime import expect
from ..runtime.cli import CliExecutionError, WorkflowInvocation
from ..runtime.expect import Query
from .support import CHILD_CONFTEST, WORKFLOW_PROBE, configure_child


@pytest.fixture
def runner(cli, tmp_path):
    script = tmp_path / "probe.py"
    script.write_text(WORKFLOW_PROBE)
    cli.command = (sys.executable, str(script))
    return cli


def test_primary_offline_guard_blocks_tcp_and_dns():
    import socket

    with socket.socket() as connection:
        for operation in (connection.connect, connection.connect_ex):
            with pytest.raises(AssertionError, match="must not access the network"):
                operation(("127.0.0.1", 1))
    for name, args in (
        ("getaddrinfo", ("example.com", 80)),
        ("gethostbyname", ("example.com",)),
        ("gethostbyname_ex", ("example.com",)),
        ("gethostbyaddr", ("127.0.0.1",)),
        ("getnameinfo", (("127.0.0.1", 80), 0)),
    ):
        with pytest.raises(AssertionError, match="must not access the network"):
            getattr(socket, name)(*args)


def test_shared_child_offline_guard_blocks_tcp_and_dns(pytester, monkeypatch):
    configure_child(pytester, monkeypatch, conftest=CHILD_CONFTEST, probe=WORKFLOW_PROBE)
    pytester.makepyfile("""
import socket
import pytest

def test_guard():
    with socket.socket() as connection:
        for operation in (connection.connect, connection.connect_ex):
            with pytest.raises(AssertionError, match="Offline framework probe"):
                operation(("127.0.0.1", 1))
    for name, args in (
        ("getaddrinfo", ("example.com", 80)),
        ("gethostbyname", ("example.com",)),
        ("gethostbyname_ex", ("example.com",)),
        ("gethostbyaddr", ("127.0.0.1",)),
        ("getnameinfo", (("127.0.0.1", 80), 0)),
    ):
        with pytest.raises(AssertionError, match="Offline framework probe"):
            getattr(socket, name)(*args)
""")
    result = pytester.runpytest_subprocess("-q")
    result.assert_outcomes(passed=1)
    assert result.ret == pytest.ExitCode.OK


def test_explicit_workflows_reject_wrong_database_and_dashboard_state(pytester, monkeypatch):
    configure_child(pytester, monkeypatch, conftest=CHILD_CONFTEST, probe=WORKFLOW_PROBE)
    pytester.makepyfile(
        test_sqlite="""
import sqlite3
import pytest
from ingestion.tests.cli_e2e_v2.runtime import expect
from ingestion.tests.cli_e2e_v2.runtime.cli import WorkflowInvocation
from ingestion.tests.cli_e2e_v2.runtime.expect import Query

@pytest.mark.parametrize("state", ["correct", "wrong"])
def test_catalog(cli, tmp_path, state):
    source_path, persisted_path = tmp_path / "source.db", tmp_path / "persisted.db"
    with sqlite3.connect(source_path) as source:
        source.execute("CREATE TABLE my_table (id INTEGER)" if state == "correct" else "CREATE TABLE wrong_table (id INTEGER)")
    def read():
        with sqlite3.connect(persisted_path) as persisted:
            return persisted.execute("SELECT name FROM observed ORDER BY name").fetchall()
    def check(rows):
        assert rows == [("my_table",)]
    cli.run(WorkflowInvocation("ingest", {"mode": "sqlite", "source": str(source_path), "persisted": str(persisted_path), "counter": str(tmp_path / "counter")}))
    expect.poll(Query("persisted SQLite tables", read)).satisfies(check)
""",
        test_dashboard="""
import pytest
from metadata.generated.schema.entity.data.dashboard import Dashboard
from ingestion.tests.cli_e2e_v2.runtime import expect
from ingestion.tests.cli_e2e_v2.runtime.cli import WorkflowInvocation
from ingestion.tests.cli_e2e_v2.runtime.expect import Query

@pytest.mark.parametrize("project", ["my_project", "wrong_project"])
def test_dashboard(cli, tmp_path, project):
    path = tmp_path / "dashboard.json"
    def check(dashboard):
        assert dashboard.name.root == "my_dashboard"
        assert dashboard.project == "my_project"
    cli.run(WorkflowInvocation("ingest", {"mode": "dashboard", "project": project, "persisted": str(path), "counter": str(tmp_path / "counter")}))
    expect.poll(Query("persisted dashboard", lambda: Dashboard.model_validate_json(path.read_text()))).satisfies(check)
""",
    )
    result = pytester.runpytest_subprocess("-q", "--junitxml=report.xml")
    result.assert_outcomes(passed=2, failed=2)
    assert result.ret == pytest.ExitCode.TESTS_FAILED
    output = result.stdout.str()
    assert "wrong_table" in output
    assert "wrong_project" in output
    report = (pytester.path / "report.xml").read_text()
    assert "wrong_table" in report
    assert "wrong_project" in report


def test_poll_attempts_do_not_rerun_cli(runner, tmp_path, polling_clock):
    counter, reads = tmp_path / "counter", tmp_path / "reads"

    def read():
        reads.write_text(str(int(reads.read_text()) + 1 if reads.exists() else 1))
        return int(reads.read_text())

    def check(observed):
        assert observed == 3

    result = runner.run(WorkflowInvocation("ingest", {"counter": str(counter)}))
    expect.poll(Query("read attempts", read)).satisfies(check)
    assert counter.read_text() == "1"
    assert reads.read_text() == "3"
    assert result.status.success is True


@pytest.mark.parametrize("error_type", [AssertionError, PermissionError, TypeError])
def test_read_failures_keep_their_type_and_are_not_retried(runner, tmp_path, polling_clock, error_type):
    counter, reads = tmp_path / "counter", tmp_path / "reads"
    error = error_type("persisted read failed")

    def read():
        reads.write_text(str(int(reads.read_text()) + 1 if reads.exists() else 1))
        raise error

    runner.run(WorkflowInvocation("ingest", {"counter": str(counter)}))
    with pytest.raises(error_type) as caught:
        expect.poll(Query("read failure", read)).satisfies(lambda _: None)
    assert caught.value is error
    assert reads.read_text() == "1"
    assert counter.read_text() == "1"


def test_expected_failure_allows_checking_persisted_state(runner, tmp_path):
    counter = tmp_path / "counter"

    def check(observed):
        assert observed == "1"

    result = runner.run(
        WorkflowInvocation("ingest", {"counter": str(counter), "exit": 1, "success": False, "errors": 1}),
        expected_exit=1,
        expected_success=False,
        expected_errors=1,
    )
    expect.poll(Query("counter after expected failure", counter.read_text)).satisfies(check)
    assert result.exit_code == 1
    assert result.status.success is False
    assert result.status.total_errors == 1


def test_record_errors_stop_before_persisted_checks(runner, tmp_path):
    def read():
        pytest.fail("Persisted observations must not hide record errors")

    with pytest.raises(CliExecutionError, match=r"errors=1.*expected.*errors=0"):
        runner.run(WorkflowInvocation("ingest", {"counter": str(tmp_path / "counter"), "errors": 1}))
        expect.poll(Query("healthy persisted entity", read)).satisfies(lambda observed: None)


def test_custom_workflow_composes_two_checkpoints_around_sqlite_ddl(pytester, monkeypatch):
    configure_child(pytester, monkeypatch, conftest=CHILD_CONFTEST, probe=WORKFLOW_PROBE)
    pytester.makepyfile("""
import sqlite3
from pathlib import Path
import pytest
from ingestion.tests.cli_e2e_v2.runtime import expect
from ingestion.tests.cli_e2e_v2.runtime.cli import WorkflowInvocation
from ingestion.tests.cli_e2e_v2.runtime.expect import Query

@pytest.fixture
def source(tmp_path):
    path = tmp_path / "source.db"
    class Source:
        def drop_table(self, name):
            assert name == "my_table"
            with sqlite3.connect(path) as connection:
                connection.execute("DROP TABLE my_table")
    instance = Source()
    instance.path = path
    with sqlite3.connect(path) as connection:
        connection.execute("CREATE TABLE my_table (id INTEGER)")
    return instance

@pytest.fixture
def persisted(tmp_path):
    path = tmp_path / "persisted.db"
    def read():
        with sqlite3.connect(path) as connection:
            return connection.execute("SELECT name FROM observed ORDER BY name").fetchall()
    return path, Query("persisted table list", read)

@pytest.fixture
def invocation(source, persisted):
    return WorkflowInvocation("ingest", {"mode": "sqlite", "source": str(source.path), "persisted": str(persisted[0]), "counter": str(Path("counter").resolve())})

def table_present(rows):
    assert rows == [("my_table",)]

def table_absent(rows):
    assert rows == []

def test_deleted_table(cli, source, invocation, persisted):
    before = cli.run(invocation)
    expect.poll(persisted[1]).satisfies(table_present)
    source.drop_table("my_table")
    after = cli.run(invocation)
    expect.poll(persisted[1]).satisfies(table_absent)
    assert before.status.success is True
    assert after.status.success is True
    assert persisted[1].read() == []
""")
    result = pytester.runpytest_subprocess("-q")
    result.assert_outcomes(passed=1)
    assert result.ret == pytest.ExitCode.OK
    assert (pytester.path / "counter").read_text() == "2"
