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
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
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


@pytest.mark.parametrize("output_file", [False, True])
def test_versions_follow_project_configuration(tmp_path, output_file):
    project = tmp_path / "ingestion"
    project.mkdir()
    (project / "pyproject.toml").write_text(
        '[tool.openmetadata.python-environments]\nsupported-python = ["3.13", "3.9", "3.10"]\n'
    )
    output = tmp_path / "outputs"
    result = run(
        sys.executable,
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
    "selection", ["[]", "null", "{}", '"alpha"', '["unknown"]', '["alpha", "alpha"]', "[1]", "[{}]", '[""]', "invalid"]
)
@pytest.mark.parametrize("field", ["DEFAULT_CONNECTORS", "SELECTED_CONNECTORS"])
def test_connectors_reject_invalid_configuration(selection, field):
    result = run(
        sys.executable,
        PLANNER,
        "connectors",
        env={
            **os.environ,
            "DEFAULT_CONNECTORS": '["alpha", "beta"]',
            "SELECTED_CONNECTORS": '["alpha"]',
            field: selection,
        },
    )
    assert result.returncode != 0
    assert not result.stdout


def gate(needs, expected):
    return run(
        sys.executable,
        PLANNER,
        "verify",
        env={**os.environ, "NEEDS_JSON": json.dumps(needs), "EXPECTED_RESULTS": json.dumps(expected)},
    )


@pytest.mark.parametrize("wanted", ["success", "skipped"])
def test_gate_accepts_declared_results(wanted):
    result = gate({"some-job": {"result": wanted}}, {"some-job": wanted})
    assert result.returncode == 0, result.stderr


@pytest.mark.parametrize("actual", ["failure", "cancelled", "skipped", None])
def test_gate_rejects_unsuccessful_required_work(actual):
    needs = {"some-job": {"result": actual}} if actual else {}
    assert gate(needs, {"some-job": "success"}).returncode != 0


def test_gate_rejects_unexpected_results_and_dependencies():
    assert gate({"a": {"result": "success"}}, {"a": "skipped"}).returncode != 0
    assert gate({"a": {"result": "success"}}, {"a": "failure"}).returncode != 0
    assert gate({"a": {"result": "success"}}, {}).returncode != 0
    assert gate({}, {}).returncode != 0


@pytest.mark.parametrize("suite", ["unit", "integration"])
@pytest.mark.parametrize("exit_code", [0, 1, 5, 124])
def test_suite_streams_output_and_preserves_nox_exit(tmp_path, suite, exit_code):
    binaries = tmp_path / "env/bin"
    binaries.mkdir(parents=True)
    (binaries / "activate").touch()
    project = tmp_path / "ingestion"
    project.mkdir()
    binary = binaries / "nox"
    binary.write_text(
        f"#!{sys.executable}\nimport json, sys\nfrom pathlib import Path\n"
        'Path("args.json").write_text(json.dumps(sys.argv[1:]))\n'
        'print("suite output")\nprint("suite diagnostic", file=sys.stderr)\n'
        f"sys.exit({exit_code})\n"
    )
    binary.chmod(0o755)
    action = yaml.safe_load((ROOT / ".github/actions/python-suite/action.yml").read_text())
    result = run(
        "bash",
        "-eo",
        "pipefail",
        "-c",
        action["runs"]["steps"][0]["run"],
        cwd=tmp_path,
        env={
            **os.environ,
            "PATH": str(binaries) + os.pathsep + os.environ["PATH"],
            "SUITE": suite,
            "NOX_ARGS": "--maxfail 1 tests/selected",
        },
    )
    assert result.returncode == exit_code, result.stderr
    assert (project / f"{suite}-test-exit-code.txt").read_text().strip() == str(exit_code)
    assert "suite output" in result.stdout
    assert "suite diagnostic" in (project / f"{suite}-test-run.log").read_text()
    assert json.loads((project / "args.json").read_text()) == [
        "--no-venv",
        "-s",
        f"{suite}-tests",
        "--",
        "--maxfail",
        "1",
        "tests/selected",
    ]


@pytest.mark.parametrize("filename", ["ci-pr.yml", "ci-merge-queue.yml", "ci-nightly.yml"])
@pytest.mark.parametrize("selected", [False, True])
def test_entrypoint_gate_requires_exactly_the_selected_dependencies(filename, selected):
    caller = workflow(filename)
    jobs = caller["jobs"]
    status = jobs["py-tests-status"]
    verification = status["steps"][-1]
    expected = verification["env"]["EXPECTED_RESULTS"].replace(
        "${{ needs.plan.outputs.python == 'true' && 'success' || 'skipped' }}", "success" if selected else "skipped"
    )
    expected = json.loads(expected)
    assert set(expected) == set(status["needs"])
    assert set(status["needs"]) == set(jobs) - {"py-tests-status", "sonar-cloud-coverage-upload", "notify"}
    needs = {job: {"result": wanted} for job, wanted in expected.items()}
    assert gate(needs, expected).returncode == 0
    for job in status["needs"]:
        failed = {**needs, job: {"result": "failure"}}
        result = gate(failed, expected)
        assert result.returncode != 0, job
    assert (
        jobs["py-checkstyle"]["steps"][1 if filename != "ci-nightly.yml" else -1]["with"]["python-version"]
        == "${{ needs.plan.outputs.highest }}"
    )
    assert jobs["type-checks"]["steps"][-1]["with"]["python-version"] == "${{ needs.plan.outputs.lowest }}"
    assert jobs["py-tests-status"]["name"] == "py-tests-status"
    assert jobs["py-checkstyle"]["name"] == "py-checkstyle"
    assert set(jobs["unit"]["needs"]) == {"plan", "models"}
    if "integration" in jobs:
        assert set(jobs["integration"]["needs"]) == {"plan", "models", "backend"}


def test_nightly_connector_defaults_have_one_source():
    caller = workflow("ci-nightly.yml")
    defaults = caller["on"]["workflow_dispatch"]["inputs"]["connectors"]["default"]
    result = run(
        sys.executable,
        PLANNER,
        "connectors",
        env={**os.environ, "DEFAULT_CONNECTORS": caller["env"]["DEFAULT_CONNECTORS"], "SELECTED_CONNECTORS": ""},
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["connectors"] == json.loads(defaults)


@pytest.mark.parametrize("caller", ["docker", "queue", "nightly"])
@pytest.mark.parametrize("exit_code", [0, 1])
def test_backend_build_forwards_the_callers_arguments_and_exit(tmp_path, caller, exit_code):
    action = yaml.safe_load((ROOT / ".github/actions/build-backend/action.yml").read_text())
    if caller == "docker":
        docker = yaml.safe_load((ROOT / ".github/actions/prepare-for-docker-build/action.yml").read_text())
        build = next(s for s in docker["runs"]["steps"] if s.get("uses", "").endswith("/build-backend"))
        args = build.get("with", {}).get("maven-args", action["inputs"]["maven-args"]["default"])
        expected = ["-DskipTests", "clean", "package"]
    else:
        jobs = workflow("ci-merge-queue.yml" if caller == "queue" else "ci-nightly.yml")["jobs"]
        build = next(s for s in jobs["backend"]["steps"] if s.get("uses", "").endswith("/build-backend"))
        args = build["with"]["maven-args"]
        expected = ["-DskipTests", "-DonlyBackend", "clean", "package", "-pl", "openmetadata-dist", "-am"]
    binary = tmp_path / "mvn"
    binary.write_text(
        f"#!{sys.executable}\nimport json, sys\nfrom pathlib import Path\n"
        'Path("args.json").write_text(json.dumps(sys.argv[1:]))\n'
        f"sys.exit({exit_code})\n"
    )
    binary.chmod(0o755)
    result = run(
        "bash",
        "-eo",
        "pipefail",
        "-c",
        action["runs"]["steps"][-1]["run"],
        cwd=tmp_path,
        env={**os.environ, "BACKEND_MAVEN_ARGS": args, "PATH": str(tmp_path) + os.pathsep + os.environ["PATH"]},
    )
    assert result.returncode == exit_code, result.stderr
    assert json.loads((tmp_path / "args.json").read_text()) == expected


def test_nightly_artifact_names_are_unique_across_invocations():
    unit_steps = workflow("py-unit.yml")["jobs"]["py-unit-tests"]["steps"]
    unit = {
        key: value
        for step in unit_steps
        if step.get("uses") in {"./.github/actions/python-suite", "./.github/actions/report-test-results"}
        for key, value in step.get("with", {}).items()
        if key in {"artifact-name", "coverage-name"}
    }
    integration = workflow("py-integration.yml")["jobs"]["py-integration-tests"]
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
    "filename, job, exit_file",
    [
        ("py-unit.yml", "py-unit-tests", "unit-test-exit-code.txt"),
        ("py-integration.yml", "py-integration-tests", "integration-test-exit-code.txt"),
        ("py-cli-e2e-tests.yml", "py-cli-e2e-tests", "cli-e2e-test-exit-code.txt"),
    ],
)
@pytest.mark.parametrize(
    "step_outcome, job_status, exit_code, report, classification, expected_exit",
    [
        ("skipped", "failure", None, None, "setup_failure", 0),
        ("success", "success", 0, "<testcase name='passes'/>", "passed", 0),
        ("failure", "failure", 1, "<testcase name='fails'><failure/></testcase>", "test_failure", 0),
        ("failure", "failure", 124, None, "hung_test", 0),
        ("success", "success", 0, None, "missing_results", 1),
        ("success", "success", 0, "<testcase name='fails'><failure/></testcase>", "test_failure", 1),
        ("skipped", "cancelled", None, None, "cancelled", 0),
    ],
)
def test_reporting_survives_skipped_execution_and_rejects_false_passes(
    tmp_path, filename, job, exit_file, step_outcome, job_status, exit_code, report, classification, expected_exit
):
    steps = workflow(filename)["jobs"][job]["steps"]
    execution = next(step for step in steps if step.get("id") == "tests")
    reporting = next(step for step in steps if step.get("uses") == "./.github/actions/report-test-results")
    assert "if" not in execution
    assert steps.index(execution) < steps.index(reporting)
    assert reporting["if"] == "${{ always() }}"
    assert reporting["with"]["step-outcome"] == "${{ steps.tests.outcome }}"
    assert reporting["with"]["exit-code-file"] == f"ingestion/{exit_file}"

    project = tmp_path / "ingestion"
    project.mkdir()
    if exit_code is not None:
        (project / exit_file).write_text(f"{exit_code}\n")
    if report:
        (project / "junit").mkdir()
        (project / "junit/test-results-fixture.xml").write_text(f"<testsuite>{report}</testsuite>")
    scripts = tmp_path / ".github/scripts"
    scripts.mkdir(parents=True)
    shutil.copy2(ROOT / ".github/scripts/classify_test_outcome.py", scripts)
    action = yaml.safe_load((ROOT / ".github/actions/report-test-results/action.yml").read_text())
    classify, upload = action["runs"]["steps"]
    inputs = reporting["with"]
    replacements = {f"${{{{ inputs.{key} }}}}": value for key, value in inputs.items()}
    replacements["${{ job.status == 'cancelled' && 'cancelled' || inputs.step-outcome }}"] = (
        "cancelled" if job_status == "cancelled" else step_outcome
    )
    environment = {key: replacements[value] for key, value in classify["env"].items()}
    summary = tmp_path / "summary.md"
    result = run(
        "bash",
        "-eo",
        "pipefail",
        "-c",
        classify["run"],
        cwd=tmp_path,
        env={**os.environ, **environment, "GITHUB_STEP_SUMMARY": str(summary)},
    )
    assert result.returncode == expected_exit, result.stderr
    outcome = project / "ci-diagnostics/outcome.json"
    data = json.loads(outcome.read_text())
    assert data["classification"] == classification
    assert data["exitCode"] == exit_code
    assert data["context"]["lane"] == inputs["artifact-name"]
    assert classification in summary.read_text()
    assert classify["if"] == upload["if"] == "${{ always() }}"
    assert any(outcome in tmp_path.glob(pattern) for pattern in upload["with"]["path"].splitlines())


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
