#  Copyright 2026 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Exercise Python CI selection, gates, suite exit codes and report collection."""

import itertools
import json
import os
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[3]
PLANNER = ROOT / "scripts/python_ci.py"
SUITE = ROOT / ".github/scripts/run_python_suite.py"


def run(*args, cwd=ROOT, env=None):
    return subprocess.run(
        [str(arg) for arg in args],
        cwd=cwd,
        env=env,
        text=True,
        capture_output=True,
        check=False,
        timeout=30,
    )


def workflow(name):
    return yaml.load((ROOT / ".github/workflows" / name).read_text(), Loader=yaml.BaseLoader)


@pytest.mark.parametrize(
    ("flow", "versions", "static", "latest", "integration"),
    [
        ("pr", ["3.12"], "3.10", "3.12", False),
        ("merge-queue", ["3.12"], "3.10", "3.12", True),
        ("nightly", ["3.10", "3.11", "3.12"], "3.10", "3.12", True),
    ],
)
def test_planner_selects_event_workloads(flow, versions, static, latest, integration):
    result = run(
        sys.executable,
        PLANNER,
        "plan",
        "--flow",
        flow,
        "--python-changed",
        "true",
        "--static-changed",
        "false",
    )
    assert result.returncode == 0, result.stderr
    selected = json.loads(result.stdout)
    assert selected["versions"] == versions
    assert selected["static-version"] == static
    assert selected["latest-version"] == latest
    assert selected["run-integration"] is integration
    assert selected["python"] is True
    assert selected["static"] is True
    assert len(selected["connectors"]) == (17 if flow == "nightly" else 0)


@pytest.mark.parametrize(
    ("python_changed", "static_changed", "expected"),
    [
        ("false", "false", (False, False)),
        ("false", "true", (False, True)),
        ("true", "false", (True, True)),
    ],
)
def test_planner_preserves_independent_static_scope(python_changed, static_changed, expected):
    result = run(
        sys.executable,
        PLANNER,
        "plan",
        "--flow",
        "pr",
        "--python-changed",
        python_changed,
        "--static-changed",
        static_changed,
    )
    assert result.returncode == 0, result.stderr
    selected = json.loads(result.stdout)
    assert (selected["python"], selected["static"]) == expected


def test_planner_uses_project_versions_and_writes_action_outputs(tmp_path):
    project = tmp_path / "ingestion"
    project.mkdir()
    (project / "pyproject.toml").write_text(
        '[tool.openmetadata.python-environments]\nsupported-python = ["3.9", "3.10", "3.13"]\n'
    )
    output = tmp_path / "outputs"
    result = run(
        sys.executable,
        PLANNER,
        "plan",
        "--flow",
        "nightly",
        "--project",
        project,
        "--python-changed",
        "true",
        "--static-changed",
        "false",
        "--connectors",
        '["mysql", "postgres"]',
        "--output",
        output,
        cwd=tmp_path,
    )
    assert result.returncode == 0, result.stderr
    values = dict(line.split("=", 1) for line in output.read_text().splitlines())
    assert json.loads(values["versions"]) == ["3.9", "3.10", "3.13"]
    assert values["static-version"] == "3.9"
    assert values["latest-version"] == "3.13"
    assert json.loads(values["connectors"]) == ["mysql", "postgres"]
    assert values["python"] == "true"


@pytest.mark.parametrize(
    "connectors",
    [
        "[]",
        "null",
        "{}",
        '"mysql"',
        '["unknown"]',
        '["mysql", "mysql"]',
        "[1]",
        "[{}]",
        "invalid",
    ],
)
def test_planner_rejects_invalid_connector_selection(connectors):
    result = run(
        sys.executable,
        PLANNER,
        "plan",
        "--flow",
        "nightly",
        "--python-changed",
        "true",
        "--static-changed",
        "true",
        "--connectors",
        connectors,
    )
    assert result.returncode != 0
    assert not result.stdout


def selected_needs(flow, selected):
    jobs = {"models": selected, "unit": selected, "py-checkstyle": True}
    if flow != "pr":
        jobs.update(backend=selected, integration=selected)
    if flow == "nightly":
        jobs["cli-e2e"] = selected
    return {
        "plan": {
            "result": "success",
            "outputs": {
                "python": str(selected).lower(),
                "static": str(selected).lower(),
            },
        },
        **{job: {"result": "success" if should_run else "skipped"} for job, should_run in jobs.items()},
    }


def gate(flow, needs):
    return run(
        sys.executable,
        PLANNER,
        "verify",
        "--flow",
        flow,
        env={**os.environ, "NEEDS_JSON": json.dumps(needs)},
    )


@pytest.mark.parametrize("flow", ["pr", "merge-queue", "nightly"])
@pytest.mark.parametrize("selected", [False, True])
def test_gate_accepts_successful_selection_and_explicit_skips(flow, selected):
    result = gate(flow, selected_needs(flow, selected))
    assert result.returncode == 0, result.stderr


@pytest.mark.parametrize(
    "job",
    ["plan", "models", "backend", "py-checkstyle", "unit", "integration", "cli-e2e"],
)
@pytest.mark.parametrize("outcome", ["failure", "cancelled", "skipped", None])
def test_gate_rejects_failed_or_missing_selected_work(job, outcome):
    needs = selected_needs("nightly", True)
    if outcome is None:
        del needs[job]
    else:
        needs[job]["result"] = outcome
    result = gate("nightly", needs)
    assert result.returncode != 0


def test_gate_rejects_unexpected_work_and_invalid_scope():
    needs = selected_needs("merge-queue", False)
    needs["unit"]["result"] = "success"
    assert gate("merge-queue", needs).returncode != 0
    needs = selected_needs("pr", False)
    needs["plan"]["outputs"]["python"] = ""
    assert gate("pr", needs).returncode != 0
    needs = selected_needs("pr", False)
    needs["plan"]["outputs"]["static"] = "true"
    assert gate("pr", needs).returncode == 0


@pytest.mark.parametrize("suite", ["unit", "integration"])
@pytest.mark.parametrize("exit_code", [0, 1, 5, 124])
def test_suite_streams_output_and_preserves_nox_exit(tmp_path, suite, exit_code):
    binary = tmp_path / "nox"
    binary.write_text(
        f"#!{sys.executable}\nimport json, sys\nfrom pathlib import Path\n"
        'Path("args.json").write_text(json.dumps(sys.argv[1:]))\n'
        'print("suite output")\nprint("suite diagnostic", file=sys.stderr)\n'
        f"sys.exit({exit_code})\n"
    )
    binary.chmod(0o755)
    result = run(
        sys.executable,
        SUITE,
        suite,
        "--nox-args=tests/integration/my_suite",
        cwd=tmp_path,
        env={**os.environ, "PATH": str(tmp_path) + os.pathsep + os.environ["PATH"]},
    )
    assert result.returncode == exit_code, result.stderr
    assert (tmp_path / f"{suite}-test-exit-code.txt").read_text().strip() == str(exit_code)
    assert "suite output" in result.stdout
    assert "suite diagnostic" in (tmp_path / f"{suite}-test-run.log").read_text()
    args = json.loads((tmp_path / "args.json").read_text())
    assert args == [
        "--no-venv",
        "-s",
        f"{suite}-tests",
        *(["--", "--standalone", "--durations=5"] if suite == "integration" else []),
        "tests/integration/my_suite",
    ]


@pytest.mark.parametrize(
    ("filename", "expected_jobs"),
    [("ci-pr.yml", 2), ("ci-merge-queue.yml", 8), ("ci-nightly.yml", 39)],
)
def test_entrypoints_expand_to_the_expected_workload_and_dependency_graph(filename, expected_jobs):
    caller = workflow(filename)
    jobs = caller["jobs"]
    planning = next(s for s in jobs["plan"]["steps"] if s.get("id") == "plan")["run"]
    flow = {
        "ci-pr.yml": "pr",
        "ci-merge-queue.yml": "merge-queue",
        "ci-nightly.yml": "nightly",
    }[filename]
    result = run(
        "bash",
        "-eo",
        "pipefail",
        "-c",
        planning,
        env={
            **os.environ,
            "PYTHON_CHANGED": "true",
            "STATIC_CHANGED": "true",
            "CONNECTORS": "",
            "GITHUB_OUTPUT": os.devnull,
        },
    )
    assert result.returncode == 0, result.stderr
    selected = run(
        sys.executable,
        PLANNER,
        "plan",
        "--flow",
        flow,
        "--python-changed",
        "true",
        "--static-changed",
        "true",
    )
    matrix = json.loads(selected.stdout)
    versions = matrix["versions"]
    count = 1 + len(versions)
    if "integration" in jobs:
        integration = workflow("py-integration.yml")["jobs"]["py-integration-tests"]["strategy"]["matrix"]
        count += len(versions) * len(integration["database"]) * len(integration["shard"])
        assert set(jobs["integration"]["needs"]) == {"plan", "models", "backend"}
    if "cli-e2e" in jobs:
        count += len(matrix["connectors"])
        default = caller["on"]["workflow_dispatch"]["inputs"]["connectors"]["default"]
        assert json.loads(default) == matrix["connectors"]
    assert count == expected_jobs
    assert set(jobs["unit"]["needs"]) == {"plan", "models"}
    assert jobs["py-checkstyle"]["needs"] == "plan"
    assert set(jobs["py-tests-status"]["needs"]) == set(jobs) - {
        "py-tests-status",
        "sonar-cloud-coverage-upload",
        "notify",
    }
    assert jobs["py-tests-status"]["name"] == "py-tests-status"
    assert jobs["py-checkstyle"]["name"] == "py-checkstyle"


def test_nightly_artifact_names_are_unique_across_invocations():
    unit = workflow("py-unit.yml")["jobs"]["py-unit-tests"]["steps"][-1]["with"]
    integration = workflow("py-integration.yml")["jobs"]["py-integration-tests"]
    execution = next(s["with"] for s in integration["steps"] if s.get("uses", "").endswith("/python-suite"))
    names = []
    for version in ["3.10", "3.11", "3.12"]:
        names.extend(
            unit[key].replace("${{ inputs.python-version }}", version) for key in ["artifact-name", "coverage-name"]
        )
        for database, shard in itertools.product(
            integration["strategy"]["matrix"]["database"],
            integration["strategy"]["matrix"]["shard"],
        ):
            names.extend(
                execution[key]
                .replace("${{ inputs.python-version }}", version)
                .replace("${{ matrix.database.name }}", database["name"])
                .replace("${{ matrix.shard.name }}", shard["name"])
                for key in ["artifact-name", "coverage-name"]
            )
    assert len(names) == 42
    assert len(set(names)) == 42


def test_coverage_collection_keeps_colliding_junit_names_and_combines_real_data(
    tmp_path,
):
    project = tmp_path / "ingestion"
    project.mkdir()
    (project / "pyproject.toml").write_text(
        '[tool.coverage.run]\nrelative_files = true\n[tool.coverage.xml]\noutput = "ci-coverage.xml"\n'
    )
    source = project / "sample.py"
    source.write_text('import sys\nif sys.argv[1] == "unit":\n    result = 1\nelse:\n    result = 2\n')
    for lane in ["unit", "integration"]:
        artifact = tmp_path / "artifacts" / lane
        artifact.mkdir(parents=True)
        result = run(
            sys.executable,
            "-m",
            "coverage",
            "run",
            "--data-file",
            artifact / ".coverage",
            source,
            lane,
            cwd=project,
        )
        assert result.returncode == 0, result.stderr
        report = tmp_path / "results" / lane
        report.mkdir(parents=True)
        (report / "test-results.xml").write_text(
            f'<testsuite name="{lane}" tests="1"><testcase name="{lane}"/></testsuite>'
        )
    result = run(
        sys.executable,
        ROOT / ".github/scripts/prepare_python_coverage.py",
        "--coverage-dir",
        tmp_path / "artifacts",
        "--results-dir",
        tmp_path / "results",
        "--project-dir",
        project,
    )
    assert result.returncode == 0, result.stderr
    xml = ET.parse(project / "ci-coverage.xml").getroot()
    assert xml.attrib["line-rate"] == "1"
    assert {ET.parse(p).getroot().attrib["name"] for p in (project / "junit").glob("*.xml")} == {"unit", "integration"}


def test_coverage_collection_fails_without_data(tmp_path):
    result = run(
        sys.executable,
        ROOT / ".github/scripts/prepare_python_coverage.py",
        "--coverage-dir",
        tmp_path,
    )
    assert result.returncode != 0
    assert "No Python coverage artifacts" in result.stderr


@pytest.mark.parametrize("exit_code", [0, 1, 5])
def test_cli_execution_collects_coverage_without_losing_test_failure(tmp_path, exit_code):
    binaries = tmp_path / "env/bin"
    binaries.mkdir(parents=True)
    (binaries / "activate").write_text("")
    (tmp_path / "ingestion").mkdir()
    (tmp_path / "site-packages").mkdir()
    python = binaries / "python"
    python.write_text("#!/bin/sh\necho site-packages\n")
    python.chmod(0o755)
    coverage = binaries / "coverage"
    coverage.write_text(
        f"#!{sys.executable}\nimport json, sys\nfrom pathlib import Path\n"
        'with Path("coverage-args.jsonl").open("a") as stream:\n'
        '    stream.write(json.dumps(sys.argv[1:]) + "\\n")\n'
        'if sys.argv[1] == "run":\n'
        f"    sys.exit({exit_code})\n"
        'if sys.argv[1] == "combine":\n'
        '    Path(".coverage.mysql").write_text("collected")\n'
    )
    coverage.chmod(0o755)
    result = run(
        "bash",
        ROOT / ".github/scripts/run_cli_e2e.sh",
        cwd=tmp_path,
        env={**os.environ, "E2E_TEST": "mysql", "PATH": str(binaries) + os.pathsep + os.environ["PATH"]},
    )
    assert result.returncode == exit_code, result.stderr
    assert (tmp_path / "ingestion/cli-e2e-test-exit-code.txt").read_text().strip() == str(exit_code)
    calls = [json.loads(line) for line in (tmp_path / "coverage-args.jsonl").read_text().splitlines()]
    assert [args[0] for args in calls] == ["run", "combine", "report"]
    assert "ingestion/tests/cli_e2e/test_cli_mysql.py" in calls[0]
    assert (tmp_path / ".coverage.mysql").read_text() == "collected"


@pytest.mark.parametrize("unavailable_docker", [False, True])
def test_diagnostics_collects_runner_evidence_when_services_are_unavailable(tmp_path, unavailable_docker):
    binaries = tmp_path / "bin"
    binaries.mkdir()
    for command in ["df", "free", "docker", "coredumpctl", "find"]:
        executable = binaries / command
        executable.write_text(
            "#!/bin/sh\n" + ("exit 1\n" if command == "docker" and unavailable_docker else 'printf "%s\\n" "$0 $*"\n')
        )
        executable.chmod(0o755)
    (tmp_path / "docker/development").mkdir(parents=True)
    runner = tmp_path / "runner"
    runner.mkdir()
    (runner / "exasol-disk-reclaim.log").write_text("fixture reclaim log")
    result = run(
        "bash",
        ROOT / ".github/scripts/python_ci_diagnostics.sh",
        cwd=tmp_path,
        env={
            **os.environ,
            "RUNNER_TEMP": str(runner),
            "GITHUB_WORKSPACE": str(tmp_path),
            "PATH": str(binaries) + os.pathsep + os.environ["PATH"],
        },
    )
    assert result.returncode == 0, result.stderr
    artifacts = runner / "python-ci-diagnostics"
    assert {path.name for path in artifacts.iterdir()} == {
        "disk-usage.txt",
        "memory-usage.txt",
        "docker-info.txt",
        "docker-disk-usage.txt",
        "docker-containers.txt",
        "docker-compose-ps.txt",
        "docker-compose.log",
        "coredumps.txt",
        "core-files.txt",
        "exasol-disk-reclaim.log",
    }
    assert "df" in (artifacts / "disk-usage.txt").read_text()
    assert "coredumpctl" in (artifacts / "coredumps.txt").read_text()
    assert (artifacts / "exasol-disk-reclaim.log").read_text() == "fixture reclaim log"
    if not unavailable_docker:
        assert "docker compose logs" in (artifacts / "docker-compose.log").read_text()
