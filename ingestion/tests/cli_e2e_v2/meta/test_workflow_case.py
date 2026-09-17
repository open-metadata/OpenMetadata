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

import os
import sys
from pathlib import Path

import pytest

from ..runtime.case import WorkflowCase, run_and_check
from ..runtime.cli import CliExecutionError, WorkflowInvocation
from ..runtime.expect import Query

NETWORK_GUARD = """
import socket

def reject_network(*args, **kwargs):
    raise AssertionError("Offline framework probe attempted network access")

socket.socket.connect = reject_network
socket.socket.connect_ex = reject_network
for name in ("getaddrinfo", "gethostbyname", "gethostbyname_ex", "gethostbyaddr", "getnameinfo"):
    setattr(socket, name, reject_network)
"""

PROBE = (
    NETWORK_GUARD
    + """
import json
import sqlite3
import sys
from pathlib import Path
import yaml

config = yaml.safe_load(Path(sys.argv[sys.argv.index("-c") + 1]).read_text())
counter = Path(config["counter"])
counter.write_text(str(int(counter.read_text()) + 1 if counter.exists() else 1))
if config.get("mode") == "sqlite":
    with sqlite3.connect(config["source"]) as source:
        names = source.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").fetchall()
    with sqlite3.connect(config["persisted"]) as persisted:
        persisted.execute("CREATE TABLE IF NOT EXISTS observed (name TEXT)")
        persisted.execute("DELETE FROM observed")
        persisted.executemany("INSERT INTO observed VALUES (?)", names)
elif config.get("mode") == "dashboard":
    from metadata.generated.schema.entity.data.dashboard import Dashboard
    dashboard = Dashboard.model_validate({
        "id": "00000000-0000-0000-0000-000000000001",
        "name": "my_dashboard",
        "project": config["project"],
        "service": {"id": "00000000-0000-0000-0000-000000000002", "type": "dashboardService"},
    })
    Path(config["persisted"]).write_text(dashboard.model_dump_json())
status = {
    "pipeline_type": "metadata", "success": config.get("success", True),
    "steps": [{"name": "Probe", "records": 1, "updated_records": 0,
               "warnings": 0, "errors": config.get("errors", 0), "filtered": 0, "failures": None}],
}
Path(sys.argv[sys.argv.index("--status-file") + 1]).write_text(json.dumps(status))
sys.exit(config.get("exit", 0))
"""
)

CHILD_CONFTEST = """
import sys
from pathlib import Path
from types import SimpleNamespace
import pytest
from ingestion.tests.cli_e2e_v2.runtime import expect

@pytest.fixture(autouse=True)
def polling_clock(monkeypatch):
    elapsed = 0.0
    def advance(seconds):
        nonlocal elapsed
        elapsed += seconds
    monkeypatch.setattr(expect, "time", SimpleNamespace(monotonic=lambda: elapsed, sleep=advance))

@pytest.fixture
def cli(cli):
    cli.command = (sys.executable, str(Path(__file__).parent / "probe.py"))
    return cli
"""


def _configure_child(pytester, monkeypatch, *, conftest=CHILD_CONFTEST):
    root = Path(__file__).resolve().parents[4]
    monkeypatch.setenv("PYTHONPATH", os.pathsep.join((str(pytester.path), str(root), str(root / "ingestion/src"))))
    pytester.makeini("[pytest]\naddopts = -p ingestion.tests.cli_e2e_v2.conftest")
    pytester.makepyfile(sitecustomize=NETWORK_GUARD, probe=PROBE)
    pytester.makeconftest(conftest)


@pytest.fixture
def runner(cli, tmp_path):
    script = tmp_path / "probe.py"
    script.write_text(PROBE)
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
    _configure_child(pytester, monkeypatch)
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


def test_imported_workflow_uses_local_fixtures_and_rejects_wrong_state(pytester, monkeypatch):
    _configure_child(pytester, monkeypatch)
    pytester.makepyfile(
        test_sqlite="""
import sqlite3
import pytest
from ingestion.tests.cli_e2e_v2.contracts.workflow import test_workflow
from ingestion.tests.cli_e2e_v2.runtime.case import WorkflowCase
from ingestion.tests.cli_e2e_v2.runtime.cli import WorkflowInvocation
from ingestion.tests.cli_e2e_v2.runtime.expect import Query

@pytest.fixture(params=["correct", "wrong"])
def workflow_case(request, tmp_path):
    source_path, persisted_path = tmp_path / "source.db", tmp_path / "persisted.db"
    with sqlite3.connect(source_path) as source:
        source.execute("CREATE TABLE my_table (id INTEGER)" if request.param == "correct" else "CREATE TABLE wrong_table (id INTEGER)")
    def read():
        with sqlite3.connect(persisted_path) as persisted:
            return persisted.execute("SELECT name FROM observed ORDER BY name").fetchall()
    def check(rows):
        assert rows == [("my_table",)]
    return WorkflowCase(
        WorkflowInvocation("ingest", {"mode": "sqlite", "source": str(source_path), "persisted": str(persisted_path), "counter": str(tmp_path / "counter")}),
        Query("persisted SQLite tables", read), check,
    )
""",
        test_dashboard="""
import pytest
from metadata.generated.schema.entity.data.dashboard import Dashboard
from ingestion.tests.cli_e2e_v2.contracts.workflow import test_workflow
from ingestion.tests.cli_e2e_v2.runtime.case import WorkflowCase
from ingestion.tests.cli_e2e_v2.runtime.cli import WorkflowInvocation
from ingestion.tests.cli_e2e_v2.runtime.expect import Query

@pytest.fixture(params=["my_project", "wrong_project"])
def workflow_case(request, tmp_path):
    path = tmp_path / "dashboard.json"
    def check(dashboard):
        assert dashboard.name.root == "my_dashboard"
        assert dashboard.project == "my_project"
    return WorkflowCase(
        WorkflowInvocation("ingest", {"mode": "dashboard", "project": request.param, "persisted": str(path), "counter": str(tmp_path / "counter")}),
        Query("persisted dashboard", lambda: Dashboard.model_validate_json(path.read_text())), check,
    )
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

    result = run_and_check(
        runner,
        WorkflowCase(WorkflowInvocation("ingest", {"counter": str(counter)}), Query("read attempts", read), check),
    )
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

    case = WorkflowCase(
        WorkflowInvocation("ingest", {"counter": str(counter)}), Query("read failure", read), lambda _: None
    )
    with pytest.raises(error_type) as caught:
        run_and_check(runner, case)
    assert caught.value is error
    assert reads.read_text() == "1"
    assert counter.read_text() == "1"


def test_expected_outcome_is_helper_policy(runner, tmp_path):
    counter = tmp_path / "counter"

    def check(observed):
        assert observed == "1"

    case = WorkflowCase(
        WorkflowInvocation("ingest", {"counter": str(counter), "exit": 1, "success": False, "errors": 1}),
        Query("counter after expected failure", counter.read_text),
        check,
    )
    result = run_and_check(runner, case, expected_exit=1, expected_success=False, expected_errors=1)
    assert result.exit_code == 1
    assert result.status.success is False
    assert result.status.total_errors == 1


def test_record_errors_stop_before_persisted_checks(runner, tmp_path):
    def read():
        pytest.fail("Persisted observations must not hide record errors")

    case = WorkflowCase(
        WorkflowInvocation("ingest", {"counter": str(tmp_path / "counter"), "errors": 1}),
        Query("healthy persisted entity", read),
        lambda observed: None,
    )
    with pytest.raises(CliExecutionError, match=r"errors=1.*expected.*errors=0"):
        run_and_check(runner, case)


def test_custom_workflow_composes_two_checkpoints_around_sqlite_ddl(pytester, monkeypatch):
    _configure_child(pytester, monkeypatch)
    pytester.makepyfile("""
import sqlite3
from pathlib import Path
import pytest
from ingestion.tests.cli_e2e_v2.runtime.case import WorkflowCase, run_and_check
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

@pytest.fixture
def before_case(invocation, persisted):
    def check(rows):
        assert rows == [("my_table",)]
    return WorkflowCase(invocation, persisted[1], check)

@pytest.fixture
def after_case(invocation, persisted):
    def check(rows):
        assert rows == []
    return WorkflowCase(invocation, persisted[1], check)

def test_deleted_table(cli, source, before_case, after_case):
    before = run_and_check(cli, before_case)
    source.drop_table("my_table")
    after = run_and_check(cli, after_case)
    assert before.status.success is True
    assert after.status.success is True
    assert after_case.persisted.read() == []
""")
    result = pytester.runpytest_subprocess("-q")
    result.assert_outcomes(passed=1)
    assert result.ret == pytest.ExitCode.OK
    assert (pytester.path / "counter").read_text() == "2"
