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
        result = subprocess.run(
            ["bash", "--noprofile", "--norc", "-eo", "pipefail", "-c", render(step["run"])],
            cwd=tmp_path,
            env={**environment, **{key: render(value) for key, value in step.get("env", {}).items()}},
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        if result.returncode or step.get("id") == "e2e-v2-test":
            return result
    raise AssertionError("Workflow did not execute its E2E test step")


@pytest.mark.parametrize("pytest_exit", [0, 1, 5])
def test_ci_runs_the_allowed_connector_and_preserves_pytest_exit(tmp_path, pytest_exit):
    result = _run_workflow(tmp_path, "mysql", pytest_exit)
    assert result.returncode == pytest_exit, result.stderr
    assert json.loads((tmp_path / "ingestion/pytest-args.json").read_text()) == [
        "-v",
        "--e2e-contract-check",
        "--junitxml=junit/test-results-v2-mysql.xml",
        "tests/cli_e2e_v2/mysql",
    ]


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
