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
"""CLI dispatch validation, command outcomes and connector credential boundaries."""

import ast
import json
import os
import re
import shlex
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[4]
_CALLERS = {
    "legacy": ("ci-nightly.yml", "python-cli-e2e", "plan"),
    "v2": ("py-cli-e2e-tests-v2.yml", "py-cli-e2e-tests-v2", "prepare-classification-models"),
}
_TEST_STEP_IDS = ("tests", "e2e-v2-test", "e2e-v2-bigquery-test", "e2e-v2-snowflake-test", "e2e-v2-redshift-test")
_SECRET_REFERENCE = re.compile(r"secrets\.([A-Za-z0-9_]+)")


def _workflows(caller):
    filename, job_id, preparation_id = _CALLERS[caller]
    workflow = yaml.load((ROOT / ".github/workflows" / filename).read_text(), Loader=yaml.BaseLoader)
    invocation = workflow["jobs"][job_id]
    reusable = yaml.load((ROOT / invocation["uses"][2:]).read_text(), Loader=yaml.BaseLoader)
    inputs = {
        name: definition["default"]
        for name, definition in reusable["on"]["workflow_call"]["inputs"].items()
        if "default" in definition
    }
    inputs.update(invocation["with"])
    return workflow, workflow["jobs"][preparation_id], reusable, inputs


def _condition_holds(condition, connector, suite):
    values = {"matrix.e2e-test": connector, "inputs.test-suite": suite, "github.ref": "refs/heads/main"}
    for clause in condition.strip().removeprefix("${{").removesuffix("}}").split("&&"):
        left, operator, right = shlex.split(clause)
        assert operator in ("==", "!="), condition
        if (values.get(left, left) == values.get(right, right)) != (operator == "=="):
            return False
    return True


def _run_workflow(tmp_path, connector, command_exit=0, caller="v2"):
    workflow, preparation, reusable, inputs = _workflows(caller)
    suite = inputs["test-suite"]
    coverage = inputs["collect-coverage"]
    if coverage.startswith("${{"):
        coverage = str(_condition_holds(coverage, connector, suite)).lower()
    job = reusable["jobs"]["py-cli-e2e-tests"]
    binaries = tmp_path / "env/bin"
    binaries.mkdir(parents=True)
    (binaries / "activate").write_text("")
    (tmp_path / "ingestion").mkdir()
    executable = binaries / "nox"
    executable.write_text(
        f"#!{sys.executable}\n"
        "import json, sys\n"
        "from pathlib import Path\n"
        "Path('nox-args.json').write_text(json.dumps(sys.argv[1:]))\n"
        f"sys.exit({command_exit})\n"
    )
    executable.chmod(0o700)

    def render(value):
        return (
            value.replace("${{ inputs.connectors }}", json.dumps([connector]))
            .replace("${{ matrix.e2e-test }}", connector)
            .replace("${{ inputs.test-suite }}", suite)
            .replace("${{ inputs.collect-coverage }}", coverage)
        )

    environment = {
        **os.environ,
        "PATH": os.pathsep.join((str(binaries), os.environ["PATH"])),
        **{key: render(value) for key, value in job.get("env", {}).items()},
        "DEFAULT_CONNECTORS": workflow["env"]["DEFAULT_CONNECTORS"],
        "SELECTED_CONNECTORS": json.dumps([connector]),
        "GITHUB_OUTPUT": str(tmp_path / "outputs"),
    }
    (tmp_path / "scripts").symlink_to(ROOT / "scripts", target_is_directory=True)
    validation = next(step for step in preparation["steps"] if step.get("id") == "connectors")
    for step in [validation, *job["steps"]]:
        if step is not validation and step.get("id") not in _TEST_STEP_IDS:
            continue
        condition = step.get("if")
        if condition is not None and not _condition_holds(condition, connector, suite):
            continue
        result = subprocess.run(
            ["bash", "--noprofile", "--norc", "-eo", "pipefail", "-c", render(step["run"])],
            cwd=tmp_path,
            env={**environment, **{key: render(value) for key, value in step.get("env", {}).items()}},
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        if result.returncode or step.get("id") in _TEST_STEP_IDS:
            return result
    raise AssertionError("Workflow did not execute its E2E test step")


@pytest.mark.parametrize(
    "caller, connector, command_exit, expected_suite, coverage",
    [
        ("legacy", "mysql", 0, "legacy", True),
        ("legacy", "mysql", 1, "legacy", True),
        ("v2", "mysql", 0, "v2", False),
        ("v2", "mysql", 1, "v2", False),
        ("v2", "bigquery", 0, "v2", False),
        ("v2", "snowflake", 0, "v2", False),
        ("v2", "redshift", 0, "v2", False),
    ],
)
def test_ci_forwards_caller_inputs_and_command_status(
    tmp_path, caller, connector, command_exit, expected_suite, coverage
):
    result = _run_workflow(tmp_path, connector, command_exit, caller)
    assert result.returncode == command_exit, result.stderr
    arguments = json.loads((tmp_path / "ingestion/nox-args.json").read_text())
    assert arguments == [
        "--no-venv",
        "-s",
        "cli-e2e",
        "--",
        connector,
        "--suite",
        expected_suite,
        *([] if coverage else ["--no-cov"]),
    ]


def test_ci_routes_each_connector_to_one_step_and_limits_its_credentials():
    _, _, reusable, _ = _workflows("v2")
    job = reusable["jobs"]["py-cli-e2e-tests"]
    steps = {step.get("id"): step for step in job["steps"]}
    for caller in _CALLERS:
        workflow, _, _, inputs = _workflows(caller)
        suite = inputs["test-suite"]
        default = workflow["on"]["workflow_dispatch"]["inputs"]["connectors"]["default"]
        assert workflow["env"]["DEFAULT_CONNECTORS"] == default
        for connector in json.loads(default):
            active = [
                step
                for step in job["steps"]
                if step.get("id") in _TEST_STEP_IDS and _condition_holds(step["if"], connector, suite)
            ]
            assert len(active) == 1, (connector, suite)
            if suite == "v2":
                assert active[0]["id"] != "tests", connector
    secrets_by_step = {
        "e2e-v2-bigquery-test": {
            "E2E_BQ_PROJECT_ID": "TEST_BQ_PROJECT_ID",
            "E2E_BQ_PROJECT_ID2": "TEST_BQ_PROJECT_ID2",
            "E2E_BQ_PRIVATE_KEY": "TEST_BQ_PRIVATE_KEY_E2E",
            "E2E_BQ_PRIVATE_KEY_ID": "TEST_BQ_PRIVATE_KEY_ID",
            "E2E_BQ_CLIENT_EMAIL": "TEST_BQ_CLIENT_EMAIL",
        },
        "e2e-v2-snowflake-test": {
            "E2E_SNOWFLAKE_ACCOUNT": "TEST_SNOWFLAKE_ACCOUNT",
            "E2E_SNOWFLAKE_USERNAME": "TEST_SNOWFLAKE_USERNAME",
            "E2E_SNOWFLAKE_PRIVATE_KEY": "TEST_SNOWFLAKE_PASSWORD_YAML",
            "E2E_SNOWFLAKE_PASSPHRASE": "TEST_SNOWFLAKE_PASSPHRASE",
            "E2E_SNOWFLAKE_WAREHOUSE": "TEST_SNOWFLAKE_WAREHOUSE",
            "E2E_SNOWFLAKE_DATABASE": "TEST_SNOWFLAKE_DATABASE_E2E",
        },
        "e2e-v2-redshift-test": {
            "E2E_REDSHIFT_HOST_PORT": "E2E_REDSHIFT_HOST_PORT",
            "E2E_REDSHIFT_USERNAME": "E2E_REDSHIFT_USERNAME",
            "E2E_REDSHIFT_PASSWORD": "E2E_REDSHIFT_PASSWORD",
        },
    }
    for owner, secrets in secrets_by_step.items():
        for key, secret in secrets.items():
            assert key not in job["env"]
            assert steps[owner]["env"][key] == f"${{{{ secrets.{secret} }}}}"
    assert "E2E_REDSHIFT_DB" not in job["env"]
    assert steps["e2e-v2-redshift-test"]["env"]["E2E_REDSHIFT_DB"] == "dev"
    owners = {
        "TEST_BQ_": "e2e-v2-bigquery-test",
        "TEST_SNOWFLAKE_": "e2e-v2-snowflake-test",
        "E2E_REDSHIFT_": "e2e-v2-redshift-test",
    }
    scopes = [("the job", {key: value for key, value in job.items() if key != "steps"})]
    scopes += [
        (step.get("id", step.get("name", step.get("uses"))), step) for step in job["steps"] if step.get("id") != "tests"
    ]
    for scope_name, scope in scopes:
        for secret in _SECRET_REFERENCE.findall(yaml.safe_dump(scope)):
            owner = next((step_id for prefix, step_id in owners.items() if secret.startswith(prefix)), scope_name)
            assert owner == scope_name, f"secrets.{secret} reaches {scope_name}"


def test_ci_rejects_an_unknown_connector_before_running_nox(tmp_path):
    result = _run_workflow(tmp_path, "unknown_connector")
    assert result.returncode != 0
    assert not (tmp_path / "ingestion/nox-args.json").exists()


def test_ci_queues_the_v1_and_v2_snowflake_jobs_in_one_group():
    """v1 drops and recreates the E2E database the v2 Snowflake job uses, so the two must never overlap."""
    for caller in _CALLERS:
        _, _, reusable, inputs = _workflows(caller)
        suite = inputs["test-suite"]
        concurrency = reusable["jobs"]["py-cli-e2e-tests"]["concurrency"]
        assert concurrency["cancel-in-progress"] == "false"
        condition, branches = concurrency["group"].removeprefix("${{").removesuffix("}}").split("&&", 1)
        group, _ = branches.split("||", 1)
        assert _condition_holds(condition, "snowflake", suite)
        assert not _condition_holds(condition, "mysql", suite)
        assert ast.literal_eval(group.strip()) == "cli-e2e-snowflake-database"
