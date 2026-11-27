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

"""Run Airflow API tests in the module's locked environment."""

import os
import subprocess
import sys
from pathlib import Path

import nox

ROOT = Path(__file__).resolve().parent


@nox.session(python=False)
def tests(session):
    """Run the API suite with optional coverage."""
    args = list(session.posargs)
    coverage = "--coverage" in args
    if coverage:
        args.remove("--coverage")
    command = [
        sys.executable,
        "-m",
        "pytest",
        "-p",
        "pytest_timeout",
        "--timeout=300",
        "--junitxml=junit/test-results-airflow-apis.xml",
    ]
    if coverage:
        command.extend(
            [
                "-p",
                "pytest_cov",
                "--cov=openmetadata_managed_apis",
                "--cov-branch",
                "--cov-config=pyproject.toml",
                "--cov-report=xml:ci-coverage.xml",
            ]
        )
        if os.environ.get("GITHUB_ACTIONS") != "true":
            command.append("--cov-report=term:skip-covered")
    command.extend(args)
    result = subprocess.run(
        command,
        cwd=ROOT,
        env={
            key: value
            for key, value in {**os.environ, **session.env, "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1"}.items()
            if value is not None
        },
        check=False,
    )
    (ROOT / "airflow-apis-test-exit-code.txt").write_text(f"{result.returncode}\n")
    if result.returncode:
        session.error(f"Airflow API tests exited with code {result.returncode}")
