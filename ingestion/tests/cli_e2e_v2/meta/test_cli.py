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
"""Real local subprocesses exercise invocation, output and status contracts."""

import copy
import json
import os
import sys

import psutil
import pytest
import yaml

from ..runtime.cli import CliExecutionError, CliRunner, WorkflowInvocation

PROBE = """
import json
import sys
from pathlib import Path
import yaml

config_path = Path(sys.argv[sys.argv.index("-c") + 1])
status_path = Path(sys.argv[sys.argv.index("--status-file") + 1])
config = yaml.safe_load(config_path.read_text())
probe = config.get("probe", {})
assert sys.argv[1] == probe.get("subcommand", "ingest")
print(probe.get("stdout", "source output"), flush=True)
print(probe.get("stderr", "source error"), file=sys.stderr, flush=True)
if probe.get("block"):
    import threading
    threading.Event().wait()
if probe.get("descendant"):
    import subprocess
    import signal
    child = subprocess.Popen([sys.executable, "-c", "import os, sys; from pathlib import Path; Path(sys.argv[1]).write_text(str(os.getpid())); sys.stdin.read(); Path(sys.argv[2]).touch()", str(config_path.parent / "descendant.pid"), probe["descendant"]], stdin=subprocess.PIPE)
    signal.pause()
if not probe.get("missing"):
    status = {
        "pipeline_type": "example",
        "ingestion_pipeline_fqn": None,
        "success": probe.get("success", True),
        "steps": [{
            "name": probe.get("step_name", "Example"), "records": 2, "updated_records": 1, "warnings": 0,
            "errors": probe.get("errors", 0), "filtered": 0,
            "failures": probe.get("failures"), "progress": None,
            "operationMetrics": None, "sourceTimeMs": None, "sinkTimeMs": None,
        }],
    }
    status_path.write_text(probe.get("raw_status", json.dumps(status)))
sys.exit(probe.get("exit", 0))
"""


@pytest.fixture
def runner(tmp_path):
    script = tmp_path / "probe.py"
    script.write_text(PROBE)
    return CliRunner(tmp_path / "cli", command=(sys.executable, str(script)))


def test_complete_invocation_preserves_config_and_separate_streams(runner, monkeypatch, capfd):
    monkeypatch.setenv("EXAMPLE_PASSWORD", "synthetic-environment-canary")
    config = {
        "source": {"type": "example-lineage", "sourceConfig": {"config": {"type": "DatabaseLineage"}}},
        "processor": {"type": "caller-selected", "config": {}},
        "password": "${EXAMPLE_PASSWORD}",
        "probe": {"subcommand": "profile"},
    }
    before = copy.deepcopy(config)
    result = runner.run(WorkflowInvocation("profile", config))
    assert result.exit_code == 0
    assert result.status.success is True
    assert result.status.total_errors == 0
    assert result.status.step("Example").records == 2
    assert config == before
    output = capfd.readouterr()
    assert "source output\n" in output.out
    assert output.err == "source error\n"
    raw = next(runner.work_dir.iterdir())
    assert yaml.safe_load((raw / "config.yaml").read_text()) == config
    if os.name == "posix":
        assert raw.stat().st_mode & 0o777 == 0o700
        for name in ("config.yaml", "status.json"):
            assert (raw / name).stat().st_mode & 0o777 == 0o600


def test_expected_failure_returns_observable_status(runner, capfd):
    result = runner.run(
        WorkflowInvocation(
            "ingest",
            {
                "probe": {
                    "exit": 1,
                    "success": False,
                    "errors": 1,
                    "failures": [{"name": "my_table", "error": "source failed", "stackTrace": None}],
                }
            },
        ),
        expected_exit=1,
        expected_success=False,
        expected_errors=1,
    )
    assert result.exit_code == 1
    assert result.status.success is False
    assert result.status.total_errors == 1
    assert result.status.all_failures == [{"name": "my_table", "error": "source failed", "stackTrace": None}]
    output = capfd.readouterr()
    assert "source output\n" in output.out
    assert output.err == "source error\n"


def test_cli_output_is_not_rewritten_by_test_harness(runner, capfd):
    canary = "synthetic-output-canary"
    invocation = WorkflowInvocation("ingest", {"password": canary, "probe": {"stdout": canary}})
    runner.run(invocation)
    assert canary in capfd.readouterr().out
    assert canary not in repr(invocation)


@pytest.mark.parametrize("exit_code,success", [(1, True), (0, False), (1, False)])
def test_exit_and_status_are_independent_requirements(runner, exit_code, success):
    with pytest.raises(CliExecutionError, match="expected exit=0, success=True") as error:
        runner.run(WorkflowInvocation("ingest", {"probe": {"exit": exit_code, "success": success}}))
    assert f"exit={exit_code}, success={success}" in str(error.value)


@pytest.mark.parametrize("failures", [None, [{"name": "my_table", "error": "source failed"}]])
def test_threshold_success_cannot_hide_record_errors(runner, failures):
    with pytest.raises(CliExecutionError, match=r"errors=1.*expected.*errors=0"):
        runner.run(WorkflowInvocation("ingest", {"probe": {"errors": 1, "failures": failures}}))


@pytest.mark.parametrize("errors", [0, 2])
def test_expected_record_errors_must_match_exactly(runner, errors):
    with pytest.raises(CliExecutionError, match=rf"errors={errors}.*expected.*errors=1"):
        runner.run(
            WorkflowInvocation("ingest", {"probe": {"exit": 1, "success": False, "errors": errors}}),
            expected_exit=1,
            expected_success=False,
            expected_errors=1,
        )


@pytest.mark.parametrize(
    "probe", [{"missing": True}, {"raw_status": "not JSON"}, {"raw_status": "{}"}, {"success": "false"}]
)
def test_missing_or_malformed_status_cannot_pass(runner, probe, capfd):
    with pytest.raises(CliExecutionError, match="missing or malformed"):
        runner.run(WorkflowInvocation("ingest", {"probe": probe}))
    assert "source output" in capfd.readouterr().out


@pytest.mark.parametrize("error_text", [None, "", "\n"])
def test_empty_error_text_does_not_break_diagnostics(runner, error_text):
    with pytest.raises(CliExecutionError, match="CLI exit=1"):
        runner.run(
            WorkflowInvocation(
                "ingest",
                {
                    "probe": {
                        "exit": 1,
                        "success": False,
                        "errors": 1,
                        "failures": [{"name": "my_table", "error": error_text, "stackTrace": None}],
                    }
                },
            )
        )


def test_second_run_cannot_reuse_previous_status(runner):
    first = runner.run(WorkflowInvocation("ingest", {}))
    first_dir = next(runner.work_dir.iterdir())
    with pytest.raises(CliExecutionError, match="missing or malformed"):
        runner.run(WorkflowInvocation("ingest", {"probe": {"missing": True}}))
    runs = set(runner.work_dir.iterdir())
    assert len(runs) == 2
    second_dir = (runs - {first_dir}).pop()
    assert not (second_dir / "status.json").exists()
    assert json.loads((first_dir / "status.json").read_text())["success"] is True
    assert first.status.success is True


@pytest.mark.skipif(os.name != "posix", reason="Process-group cancellation is supported on Linux/macOS")
def test_timeout_cancels_real_child_and_descendant_without_late_writes(runner, tmp_path, capfd):
    sentinel = tmp_path / "descendant-completed"
    with pytest.raises(CliExecutionError, match="timed out"):
        runner.run(WorkflowInvocation("ingest", {"probe": {"descendant": str(sentinel)}}), timeout=1)
    raw = next(runner.work_dir.iterdir())
    pid = int((raw / "descendant.pid").read_text())
    try:
        descendant = psutil.Process(pid)
    except psutil.NoSuchProcess:
        pass
    else:
        psutil.wait_procs([descendant], timeout=3)
        assert not descendant.is_running() or descendant.status() == psutil.STATUS_ZOMBIE
    assert not sentinel.exists()
    output = capfd.readouterr()
    assert "source output" in output.out
    assert "exit=-9" in output.out
    assert "source error" in output.err


def test_spawn_failure_preserves_the_original_os_error(tmp_path):
    command = str(tmp_path / "missing-metadata-command")
    runner = CliRunner(tmp_path / "cli", command=(command,))
    with pytest.raises(CliExecutionError, match="Could not start CLI ingest") as error:
        runner.run(WorkflowInvocation("ingest", {}))
    assert isinstance(error.value.__cause__, FileNotFoundError)
    assert command in str(error.value)
