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

import json
import os
import re
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

_CONDITION_CLAUSE = re.compile(r"^(matrix\.e2e-test|inputs\.test-suite) (==|!=) '([a-z0-9]+)'$")
_TEST_STEP_IDS = ("e2e-v2-test", "e2e-v2-bigquery-test", "e2e-v2-snowflake-test")
_SECRET_REFERENCE = re.compile(r"secrets\.([A-Za-z0-9_]+)")
_SNOWFLAKE_CONCURRENCY_GROUP = re.compile(
    r"^\$\{\{ matrix\.(?P<key>[a-z0-9-]+) == 'snowflake' && '(?P<group>[a-z0-9-]+)' "
    r"\|\| format\('\{0\}-\{1\}-\{2\}', github\.workflow, github\.run_id, matrix\.(?P=key)\) \}\}$"
)


def _condition_holds(condition, connector, suite):
    outcomes = []
    for clause in condition.split(" && "):
        match = _CONDITION_CLAUSE.match(clause.strip())
        assert match, f"unsupported step condition: {condition}"
        variable, operator, name = match.groups()
        value = connector if variable == "matrix.e2e-test" else suite
        outcomes.append((value == name) == (operator == "=="))
    return all(outcomes)


def _run_workflow(tmp_path, connector, test_exit=0, suite="v2"):
    root = Path(__file__).resolve().parents[4]
    workflow = yaml.safe_load((root / ".github/workflows/py-cli-e2e-tests-v2.yml").read_text())
    preparation = workflow["jobs"]["prepare-classification-models"]
    job = yaml.safe_load((root / ".github/workflows/reusable-py-cli-e2e-tests.yml").read_text())["jobs"][
        "py-cli-e2e-tests"
    ]
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
        f"sys.exit({test_exit})\n"
    )
    executable.chmod(0o700)

    def render(value):
        return (
            value.replace("${{ inputs.connectors }}", json.dumps([connector]))
            .replace("${{ matrix.e2e-test }}", connector)
            .replace("${{ inputs.test-suite }}", suite)
            .replace("${{ inputs.collect-coverage }}", "false")
        )

    environment = {
        **os.environ,
        "PATH": os.pathsep.join((str(binaries), os.environ["PATH"])),
        **{key: render(value) for key, value in job.get("env", {}).items()},
        "DEFAULT_CONNECTORS": workflow["env"]["DEFAULT_CONNECTORS"],
        "SELECTED_CONNECTORS": json.dumps([connector]),
        "GITHUB_OUTPUT": str(tmp_path / "outputs"),
    }
    (tmp_path / "scripts").symlink_to(root / "scripts", target_is_directory=True)
    validation = next(step for step in preparation["steps"] if step.get("id") == "connectors")
    for step in [validation, *job["steps"]]:
        if step is not validation and step.get("id") not in (*_TEST_STEP_IDS, "tests"):
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
        if result.returncode or step.get("id") in (*_TEST_STEP_IDS, "tests"):
            return result
    raise AssertionError("Workflow did not execute its E2E test step")


@pytest.mark.parametrize("connector", ["mysql", "postgres", "bigquery", "oracle", "snowflake", "mssql"])
@pytest.mark.parametrize("test_exit", [0, 1, 5])
@pytest.mark.parametrize("suite", ["legacy", "v2"])
def test_ci_runs_the_allowed_connector_and_preserves_test_exit(tmp_path, connector, test_exit, suite):
    result = _run_workflow(tmp_path, connector, test_exit, suite)
    assert result.returncode == test_exit, result.stderr
    assert json.loads((tmp_path / "ingestion/nox-args.json").read_text()) == [
        "--no-venv",
        "-s",
        "cli-e2e",
        "--",
        connector,
        "--suite",
        suite,
        "--no-cov",
    ]


def test_ci_defaults_to_all_connectors_and_limits_each_connectors_secrets():
    root = Path(__file__).resolve().parents[4]
    workflow = yaml.safe_load((root / ".github/workflows/py-cli-e2e-tests-v2.yml").read_text())
    job = yaml.safe_load((root / ".github/workflows/reusable-py-cli-e2e-tests.yml").read_text())["jobs"][
        "py-cli-e2e-tests"
    ]
    dispatch = workflow.get("on", workflow.get(True))["workflow_dispatch"]
    default = dispatch["inputs"]["connectors"]["default"]
    assert json.loads(default) == ["mysql", "postgres", "bigquery", "oracle", "snowflake", "mssql"]
    assert workflow["env"]["DEFAULT_CONNECTORS"] == default

    steps = {step.get("id"): step for step in job["steps"]}
    for connector in json.loads(default):
        for suite in ("legacy", "v2"):
            active = [
                step
                for step in job["steps"]
                if step.get("id") in (*_TEST_STEP_IDS, "tests") and _condition_holds(step["if"], connector, suite)
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
    }
    for owner, secrets in secrets_by_step.items():
        for key, secret in secrets.items():
            assert key not in job["env"]
            assert steps[owner]["env"][key] == f"${{{{ secrets.{secret} }}}}"
    # Every field of the job and of every step is scanned, so no other step can read a connector's
    # secrets under any variable name, input or script.
    owners = {"TEST_BQ_": "e2e-v2-bigquery-test", "TEST_SNOWFLAKE_": "e2e-v2-snowflake-test"}
    scopes = [("the job", {key: value for key, value in job.items() if key != "steps"})]
    scopes += [
        (step.get("id", step.get("name", step.get("uses"))), step) for step in job["steps"] if step.get("id") != "tests"
    ]
    for scope_name, scope in scopes:
        for secret in _SECRET_REFERENCE.findall(yaml.safe_dump(scope)):
            owner = next((step_id for prefix, step_id in owners.items() if secret.startswith(prefix)), scope_name)
            assert owner == scope_name, f"secrets.{secret} reaches {scope_name}"


@pytest.mark.parametrize(
    "connector",
    [
        "",
        "metabase",
        "meta",
        "../meta",
        "mysql ../meta",
        "mysql; touch injected; #",
        "mysql$(touch injected)",
        "mysql`touch injected`",
        "mysql\ntouch injected\n#",
    ],
)
def test_ci_rejects_unsupported_connectors_without_running_commands(tmp_path, connector):
    result = _run_workflow(tmp_path, connector)
    assert not list(tmp_path.rglob("injected"))
    assert result.returncode != 0
    assert not (tmp_path / "ingestion/nox-args.json").exists()


def test_ci_queues_the_v1_and_v2_snowflake_jobs_in_one_group():
    """v1 drops and recreates the E2E database the v2 Snowflake job uses, so the two must never overlap."""
    root = Path(__file__).resolve().parents[4]
    runner = "./.github/workflows/reusable-py-cli-e2e-tests.yml"
    for workflow_file, job_id in (
        ("py-cli-e2e-tests-v2.yml", "py-cli-e2e-tests-v2"),
        ("ci-nightly.yml", "python-cli-e2e"),
    ):
        entrypoint = yaml.load((root / ".github/workflows" / workflow_file).read_text(), Loader=yaml.BaseLoader)
        connectors = json.loads(entrypoint["on"]["workflow_dispatch"]["inputs"]["connectors"]["default"])
        assert "snowflake" in connectors
        assert entrypoint["jobs"][job_id]["uses"] == runner
    job = yaml.safe_load((root / runner[2:]).read_text())["jobs"]["py-cli-e2e-tests"]
    assert job["concurrency"]["cancel-in-progress"] is False
    match = _SNOWFLAKE_CONCURRENCY_GROUP.match(job["concurrency"]["group"])
    assert match, job["concurrency"]["group"]
    assert match["group"] == "cli-e2e-snowflake-database"
    assert match["key"] == "e2e-test"
