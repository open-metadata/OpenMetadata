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
import subprocess
import sys
from pathlib import Path

import pytest
import yaml


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
        if condition is not None:
            assert condition in ("matrix.connector == 'bigquery'", "matrix.connector != 'bigquery'")
            if (connector == "bigquery") != (condition == "matrix.connector == 'bigquery'"):
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
        if result.returncode or step.get("id") in ("e2e-v2-test", "e2e-v2-bigquery-test"):
            return result
    raise AssertionError("Workflow did not execute its E2E test step")


@pytest.mark.parametrize("connector", ["mysql", "postgres", "bigquery"])
@pytest.mark.parametrize("pytest_exit", [0, 1, 5])
def test_ci_runs_the_allowed_connector_and_preserves_pytest_exit(tmp_path, connector, pytest_exit):
    result = _run_workflow(tmp_path, connector, pytest_exit)
    assert result.returncode == pytest_exit, result.stderr
    expected_args = [
        "-v",
        "--e2e-contract-check",
    ]
    if connector == "bigquery":
        expected_args.extend(["-n", "6"])
    expected_args.extend(
        [
            f"--junitxml=junit/test-results-v2-{connector}.xml",
            f"tests/cli_e2e_v2/{connector}",
        ]
    )
    assert json.loads((tmp_path / "ingestion/pytest-args.json").read_text()) == expected_args


def test_ci_defaults_to_all_connectors_and_limits_bigquery_secrets():
    root = Path(__file__).resolve().parents[4]
    workflow = yaml.safe_load((root / ".github/workflows/py-cli-e2e-tests-v2.yml").read_text())
    job = workflow["jobs"]["py-cli-e2e-tests-v2"]
    dispatch = workflow.get("on", workflow.get(True))["workflow_dispatch"]
    default = dispatch["inputs"]["connectors"]["default"]
    assert json.loads(default) == ["mysql", "postgres", "bigquery"]
    assert f"'{default}'" in job["strategy"]["matrix"]["connector"]

    regular_step = next(step for step in job["steps"] if step.get("id") == "e2e-v2-test")
    bigquery_step = next(step for step in job["steps"] if step.get("id") == "e2e-v2-bigquery-test")
    assert regular_step["if"] == "matrix.connector != 'bigquery'"
    assert bigquery_step["if"] == "matrix.connector == 'bigquery'"
    for key, secret in {
        "E2E_BQ_PROJECT_ID": "TEST_BQ_PROJECT_ID",
        "E2E_BQ_PROJECT_ID2": "TEST_BQ_PROJECT_ID2",
        "E2E_BQ_PRIVATE_KEY": "TEST_BQ_PRIVATE_KEY_E2E",
        "E2E_BQ_PRIVATE_KEY_ID": "TEST_BQ_PRIVATE_KEY_ID",
        "E2E_BQ_CLIENT_EMAIL": "TEST_BQ_CLIENT_EMAIL",
    }.items():
        assert key not in job["env"]
        assert key not in regular_step["env"]
        assert bigquery_step["env"][key] == f"${{{{ secrets.{secret} }}}}"


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
