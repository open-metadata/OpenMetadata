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

"""Exercise Python CI selection and report collection."""

import itertools
import json
import os
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


def test_nightly_artifact_names_are_unique_across_invocations():
    unit_steps = yaml.load((ROOT / ".github/actions/python-unit/action.yml").read_text(), Loader=yaml.BaseLoader)[
        "runs"
    ]["steps"]
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
    "directory, step_outcome, exit_code, classification",
    [
        ("ingestion", "success", 0, "passed"),
        ("openmetadata-airflow-apis", "success", 0, "passed"),
        ("ingestion", "skipped", None, "setup_failure"),
        ("openmetadata-airflow-apis", "failure", 124, "hung_test"),
        ("ingestion", "success", 0, "missing_results"),
    ],
)
def test_reporting_records_outcomes_and_keeps_only_failure_logs(
    tmp_path, step_outcome, exit_code, classification, directory
):
    project = tmp_path / directory
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
            "TEST_DIRECTORY": directory,
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
    for name, command in (
        ("df", "printf 'runner disk evidence\\n'"),
        ("free", "printf 'runner memory evidence\\n'"),
        ("docker", "exit 1"),
    ):
        binary = binaries / name
        binary.write_text(f"#!/bin/sh\n{command}\n")
        binary.chmod(0o755)
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
    assert (artifacts / "disk-usage.txt").read_text() == "runner disk evidence\n"
    assert (artifacts / "memory-usage.txt").read_text() == "runner memory evidence\n"


@pytest.fixture
def docker_commands(tmp_path, monkeypatch):
    binaries = tmp_path / "bin"
    binaries.mkdir()
    commands = tmp_path / "docker-commands.jsonl"
    docker = binaries / "docker"
    docker.write_text(
        "#!/usr/bin/env python3\n"
        "import json, os, sys\n"
        "args = sys.argv[1:]\n"
        "with open(os.environ['DOCKER_COMMANDS'], 'a') as output:\n"
        "    output.write(json.dumps(args) + '\\n')\n"
        "if args == ['load']:\n"
        "    sys.stdin.buffer.read()\n"
        "elif args[:2] == ['image', 'inspect']:\n"
        "    print(os.environ['IMAGE_REVISION'])\n"
        "elif 'config' in args:\n"
        "    if '--services' in args:\n"
        "        print('mysql\\nelasticsearch\\nexecute-migrate-all\\nopenmetadata-server\\ningestion')\n"
        "    else:\n"
        "        print(json.dumps({'name': 'ci-demo', 'services': {\n"
        "            'execute-migrate-all': {}, 'openmetadata-server': {'image': 'ci-demo-server'}}}))\n"
        "elif 'up' in args:\n"
        "    sys.exit(1)\n"
    )
    docker.chmod(0o755)
    monkeypatch.setenv("PATH", str(binaries) + os.pathsep + os.environ["PATH"])
    monkeypatch.setenv("DOCKER_COMMANDS", str(commands))
    return commands


@pytest.mark.parametrize("matching_revision", [True, False])
def test_backend_image_load_checks_revision_and_prepares_compose_tags(
    tmp_path, monkeypatch, docker_commands, matching_revision
):
    source = tmp_path / "image.tar"
    source.write_bytes(b"image archive")
    archive = tmp_path / "image.tar.zst"
    compressed = run("zstd", "-q", source, "-o", archive)
    assert compressed.returncode == 0, compressed.stderr
    revision = run("git", "rev-parse", "HEAD").stdout.strip()
    monkeypatch.setenv("IMAGE_REVISION", revision if matching_revision else "other-source")
    environment = tmp_path / "environment"
    monkeypatch.setenv("GITHUB_ENV", str(environment))
    result = run("bash", ROOT / ".github/scripts/ci_backend_image.sh", "load", archive)
    commands = [json.loads(line) for line in docker_commands.read_text().splitlines()]
    tags = [command[-1] for command in commands if command[:2] == ["image", "tag"]]
    if matching_revision:
        assert result.returncode == 0, result.stderr
        assert set(tags) == {"ci-demo-execute-migrate-all", "ci-demo-server"}
        assert environment.read_text() == "OM_BACKEND_IMAGE_PRELOADED=true\n"
        assert not archive.exists()
    else:
        assert result.returncode != 0
        assert not tags
        assert not environment.exists()
        assert archive.exists()


@pytest.mark.parametrize(
    "database, ingestion, backend_preloaded, ingestion_preloaded, expected",
    [
        ("mysql", False, False, False, {"mysql", "elasticsearch", "execute-migrate-all", "openmetadata-server"}),
        ("mysql", False, True, False, {"mysql", "elasticsearch"}),
        ("postgresql", False, True, False, {"postgresql", "opensearch"}),
        ("mysql", True, True, False, {"mysql", "elasticsearch", "ingestion"}),
        ("mysql", True, True, True, {"mysql", "elasticsearch"}),
        ("mysql", True, False, True, {"mysql", "elasticsearch", "execute-migrate-all", "openmetadata-server"}),
    ],
)
def test_stack_builds_only_services_without_preloaded_images(
    monkeypatch, docker_commands, database, ingestion, backend_preloaded, ingestion_preloaded, expected
):
    monkeypatch.setenv("OM_BACKEND_IMAGE_PRELOADED", str(backend_preloaded).lower())
    monkeypatch.setenv("OM_INGESTION_IMAGE_PRELOADED", str(ingestion_preloaded).lower())
    monkeypatch.setenv("VIRTUAL_ENV", "")
    result = run(
        "bash",
        ROOT / "docker/run_local_docker.sh",
        "-m",
        "no-ui",
        "-s",
        "true",
        "-r",
        "false",
        "-d",
        database,
        "-i",
        str(ingestion).lower(),
    )
    assert result.returncode == 1
    assert "Failed to start Docker instances" in result.stdout
    commands = [json.loads(line) for line in docker_commands.read_text().splitlines()]
    builds = [command for command in commands if "build" in command]
    assert len(builds) == 1
    arguments = builds[0][builds[0].index("build") + 1 :]
    if arguments[:1] == ["--build-arg"]:
        arguments = arguments[2:]
    assert set(arguments) == expected
