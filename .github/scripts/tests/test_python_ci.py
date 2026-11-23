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

import fnmatch
import itertools
import json
import os
import runpy
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[3]
PLANNER = ROOT / "scripts/python_ci.py"


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


def test_generation_inputs_select_python_workloads():
    generation = runpy.run_path(str(ROOT / "scripts/check_generated_models.py"))
    rules = yaml.safe_load((ROOT / ".github/python-ci/paths.yml").read_text())["python"]
    changed = [path.relative_to(ROOT).as_posix() for path in generation["input_paths"]()]
    omitted = [path for path in changed if not any(fnmatch.fnmatchcase(path, pattern) for pattern in rules)]
    assert not omitted, f"Generation inputs would skip Python CI: {omitted}"


@pytest.mark.parametrize("output_file", [False, True])
def test_versions_follow_project_configuration(tmp_path, output_file):
    project = tmp_path / "ingestion"
    project.mkdir()
    (project / "pyproject.toml").write_text(
        '[tool.openmetadata.python-environments]\nsupported-python = ["3.13", "3.9", "3.10"]\n'
    )
    output = tmp_path / "outputs"
    interpreter = [sys.executable]
    if sys.version_info >= (3, 11):
        interpreter.extend(["-E", "-S"])
    result = run(
        *interpreter,
        PLANNER,
        "versions",
        "--project",
        project,
        *(["--output", output] if output_file else []),
        cwd=tmp_path,
    )
    assert result.returncode == 0, result.stderr
    if output_file:
        values = dict(line.split("=", 1) for line in output.read_text().splitlines())
        values["versions"] = json.loads(values["versions"])
    else:
        values = json.loads(result.stdout)
    assert values == {"versions": ["3.13", "3.9", "3.10"], "lowest": "3.9", "highest": "3.13"}


@pytest.mark.parametrize("selected, expected", [("", ["alpha", "beta"]), ('["beta"]', ["beta"])])
def test_connectors_use_the_callers_defaults(selected, expected):
    result = run(
        sys.executable,
        PLANNER,
        "connectors",
        env={
            **os.environ,
            "DEFAULT_CONNECTORS": '["alpha", "beta"]',
            "SELECTED_CONNECTORS": selected,
        },
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == {"connectors": expected}


@pytest.mark.parametrize(
    "defaults, selected",
    [
        ("invalid", ""),
        ("{}", ""),
        ("[]", ""),
        ('["alpha", "alpha"]', ""),
        ("[1]", ""),
        ('["alpha"]', "null"),
        ('["alpha"]', '["unknown"]'),
    ],
)
def test_connectors_reject_invalid_configuration(defaults, selected):
    result = run(
        sys.executable,
        PLANNER,
        "connectors",
        env={**os.environ, "DEFAULT_CONNECTORS": defaults, "SELECTED_CONNECTORS": selected},
    )
    assert result.returncode != 0
    assert not result.stdout


@pytest.fixture(params=["ci-pr.yml", "ci-merge-queue.yml", "ci-nightly.yml"])
def gate(request):
    script = workflow(request.param)["jobs"]["py-tests-status"]["steps"][0]["run"]

    def invoke(needs, expected):
        return run(
            "bash",
            "-eo",
            "pipefail",
            "-c",
            script,
            env={**os.environ, "NEEDS_JSON": json.dumps(needs), "EXPECTED_RESULTS": json.dumps(expected)},
        )

    return invoke


@pytest.mark.parametrize("wanted", ["success", "skipped"])
def test_gate_accepts_declared_results(gate, wanted):
    result = gate(
        {"plan": {"result": "success"}, "some-job": {"result": wanted}},
        {"plan": "success", "some-job": wanted},
    )
    assert result.returncode == 0, result.stderr


@pytest.mark.parametrize("actual", ["failure", "cancelled", "skipped", None])
def test_gate_rejects_unsuccessful_required_work(gate, actual):
    needs = {"plan": {"result": "success"}}
    if actual:
        needs["some-job"] = {"result": actual}
    assert gate(needs, {"plan": "success", "some-job": "success"}).returncode != 0


def test_gate_rejects_unexpected_results_and_dependencies(gate):
    assert gate({"a": {"result": "success"}}, {"a": "skipped"}).returncode != 0
    assert gate({"a": {"result": "success"}}, {"a": "failure"}).returncode != 0
    assert gate({"a": {"result": "success"}}, {}).returncode != 0
    assert gate({}, {}).returncode != 0
    assert gate({"a": {"result": "success"}, "omitted-job": {"result": "failure"}}, {"a": "success"}).returncode != 0


def test_nightly_artifact_names_are_unique_across_invocations():
    unit_steps = workflow("reusable-py-unit.yml")["jobs"]["py-unit-tests"]["steps"]
    unit = {
        key: value
        for step in unit_steps
        if step.get("uses") in {"./.github/actions/python-suite", "./.github/actions/report-test-results"}
        for key, value in step.get("with", {}).items()
        if key in {"artifact-name", "coverage-name"}
    }
    integration = workflow("reusable-py-integration.yml")["jobs"]["py-integration-tests"]
    results = {
        key: value
        for step in integration["steps"]
        if step.get("uses") in {"./.github/actions/python-suite", "./.github/actions/report-test-results"}
        for key, value in step.get("with", {}).items()
        if key in {"artifact-name", "coverage-name"}
    }
    names = []
    for version in ["3.9", "3.13"]:
        names.extend(
            unit[key].replace("${{ inputs.python-version }}", version) for key in ["artifact-name", "coverage-name"]
        )
        for database, shard in itertools.product(
            integration["strategy"]["matrix"]["database"], integration["strategy"]["matrix"]["shard"]
        ):
            names.extend(
                results[key]
                .replace("${{ inputs.python-version }}", version)
                .replace("${{ matrix.database.name }}", database["name"])
                .replace("${{ matrix.shard.name }}", shard["name"])
                for key in ["artifact-name", "coverage-name"]
            )
    assert len(names) == len(set(names))


@pytest.mark.parametrize(
    "step_outcome, exit_code, classification",
    [
        ("skipped", None, "setup_failure"),
        ("failure", 124, "hung_test"),
        ("failure", 1, "hung_test"),
        ("success", 0, "passed"),
        ("success", 0, "missing_results"),
    ],
)
def test_reporting_records_outcomes_and_keeps_only_failure_logs(tmp_path, step_outcome, exit_code, classification):
    project = tmp_path / "ingestion"
    project.mkdir()
    log = project / "unit-test-run.log"
    log.write_text("test process timed out\n" if classification == "hung_test" else "test output\n")
    if classification == "passed":
        reports = project / "junit"
        reports.mkdir()
        (reports / "test-results-unit.xml").write_text('<testsuite><testcase name="selected"/></testsuite>')
    exit_file = project / "test-exit-code.txt"
    if exit_code is not None:
        exit_file.write_text(f"{exit_code}\n")
    scripts = tmp_path / ".github/scripts"
    scripts.mkdir(parents=True)
    shutil.copy2(ROOT / ".github/scripts/classify_test_outcome.py", scripts)
    action = yaml.safe_load((ROOT / ".github/actions/report-test-results/action.yml").read_text())
    script = next(step["run"] for step in action["runs"]["steps"] if "run" in step)
    summary = tmp_path / "summary.md"
    result = run(
        "bash",
        "-eo",
        "pipefail",
        "-c",
        script,
        cwd=tmp_path,
        env={
            **os.environ,
            "TEST_STEP_OUTCOME": step_outcome,
            "EXIT_CODE_FILE": str(exit_file),
            "TEST_PROFILE": "python-tests",
            "TEST_LANE": "sample-lane",
            "GITHUB_STEP_SUMMARY": str(summary),
        },
    )
    assert result.returncode == int(classification == "missing_results"), result.stderr
    data = json.loads((project / "ci-diagnostics/outcome.json").read_text())
    assert data["classification"] == classification
    assert data["exitCode"] == exit_code
    assert data["context"]["lane"] == "sample-lane"
    assert len(data["diagnostics"]) == int(step_outcome != "success")
    assert classification in summary.read_text()


def test_diagnostics_keeps_runner_evidence_without_docker(tmp_path):
    binaries = tmp_path / "bin"
    binaries.mkdir()
    docker = binaries / "docker"
    docker.write_text("#!/bin/sh\nexit 1\n")
    docker.chmod(0o755)
    runner = tmp_path / "runner"
    runner.mkdir()
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
    assert (artifacts / "disk-usage.txt").stat().st_size > 0
    assert (artifacts / "memory-usage.txt").exists()
