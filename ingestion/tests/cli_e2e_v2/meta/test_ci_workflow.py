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
"""Live CI shell steps reject unsafe dispatch input and preserve pytest outcomes."""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

_CONDITION_CLAUSE = re.compile(r"^matrix\.connector (==|!=) '([a-z]+)'$")
_TEST_STEP_IDS = ("e2e-v2-test", "e2e-v2-bigquery-test", "e2e-v2-snowflake-test")


def _condition_holds(condition, connector):
    """Evaluate the `matrix.connector` comparisons, joined by `&&`, that the workflow's step conditions use."""
    outcomes = []
    for clause in condition.split(" && "):
        match = _CONDITION_CLAUSE.match(clause.strip())
        assert match, f"unsupported step condition: {condition}"
        operator, name = match.groups()
        outcomes.append((connector == name) == (operator == "=="))
    return all(outcomes)


def _run_workflow(tmp_path, connector, pytest_exit=0):
    root = Path(__file__).resolve().parents[4]
    workflow = yaml.safe_load((root / ".github/workflows/py-cli-e2e-tests-v2.yml").read_text())
    job = workflow["jobs"]["py-cli-e2e-tests-v2"]
    binaries = tmp_path / "env/bin"
    binaries.mkdir(parents=True)
    (binaries / "activate").write_text("")
    (tmp_path / "ingestion").mkdir()
    executable = binaries / "pytest"
    executable.write_text(
        f"#!{sys.executable}\n"
        "import json, sys\n"
        "from pathlib import Path\n"
        "Path('pytest-args.json').write_text(json.dumps(sys.argv[1:]))\n"
        f"sys.exit({pytest_exit})\n"
    )
    executable.chmod(0o700)

    def render(value):
        return value.replace("${{ matrix.connector }}", connector)

    environment = {
        **os.environ,
        "PATH": os.pathsep.join((str(binaries), os.environ["PATH"])),
        **{key: render(value) for key, value in job.get("env", {}).items()},
    }
    for step in job["steps"]:
        if "run" not in step:
            continue
        condition = step.get("if")
        if condition is not None and not _condition_holds(condition, connector):
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


@pytest.mark.parametrize("connector", ["mysql", "postgres", "bigquery", "snowflake"])
@pytest.mark.parametrize("pytest_exit", [0, 1, 5])
def test_ci_runs_the_allowed_connector_and_preserves_pytest_exit(tmp_path, connector, pytest_exit):
    result = _run_workflow(tmp_path, connector, pytest_exit)
    assert result.returncode == pytest_exit, result.stderr
    expected_args = [
        "-v",
        "--e2e-contract-check",
    ]
    workers = {"bigquery": "6", "snowflake": "4"}
    if connector in workers:
        expected_args.extend(["-n", workers[connector]])
    expected_args.extend(
        [
            f"--junitxml=junit/test-results-v2-{connector}.xml",
            f"tests/cli_e2e_v2/{connector}",
        ]
    )
    assert json.loads((tmp_path / "ingestion/pytest-args.json").read_text()) == expected_args


def test_ci_defaults_to_all_connectors_and_limits_each_connectors_secrets():
    root = Path(__file__).resolve().parents[4]
    workflow = yaml.safe_load((root / ".github/workflows/py-cli-e2e-tests-v2.yml").read_text())
    job = workflow["jobs"]["py-cli-e2e-tests-v2"]
    dispatch = workflow.get("on", workflow.get(True))["workflow_dispatch"]
    default = dispatch["inputs"]["connectors"]["default"]
    assert json.loads(default) == ["mysql", "postgres", "bigquery", "snowflake"]
    assert f"'{default}'" in job["strategy"]["matrix"]["connector"]

    steps = {step.get("id"): step for step in job["steps"]}
    regular_step, bigquery_step, snowflake_step = (steps[step_id] for step_id in _TEST_STEP_IDS)
    assert regular_step["if"] == "matrix.connector != 'bigquery' && matrix.connector != 'snowflake'"
    assert bigquery_step["if"] == "matrix.connector == 'bigquery'"
    assert snowflake_step["if"] == "matrix.connector == 'snowflake'"
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
            for step_id in _TEST_STEP_IDS:
                if step_id == owner:
                    assert steps[step_id]["env"][key] == f"${{{{ secrets.{secret} }}}}"
                else:
                    assert key not in steps[step_id]["env"]


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
    assert not (tmp_path / "ingestion/pytest-args.json").exists()
