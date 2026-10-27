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

"""Prepare small real locked projects for Python command regression tests."""

import importlib.metadata
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def prepare_locked_tooling(root, monkeypatch):
    """Copy the command implementation and lock only the fixture's tools."""
    for name in [
        "OM_PYTHON_ENVIRONMENT",
        "UV_PROJECT_ENVIRONMENT",
        "ARGS",
        "MAKEFLAGS",
        "MFLAGS",
        "MAKEOVERRIDES",
        "MAKELEVEL",
    ]:
        monkeypatch.delenv(name, raising=False)
    project = root / "ingestion"
    config = project / "pyproject.toml"
    sections = re.split(r"(?m)(?=^\[)", config.read_text())
    tools = "".join(s for s in sections if s.startswith(("[tool.pytest", "[tool.coverage", "[tool.ruff")))
    requirements = {
        name: f"{name}=={importlib.metadata.version(name)}"
        for name in [
            "nox",
            "pytest",
            "pytest-cov",
            "pytest-xdist",
            "pytest-timeout",
            "coverage",
            "ruff",
            "packaging",
            "pip",
        ]
    }
    config.write_text(
        '''[build-system]
requires = ["setuptools==83.0.0"]
build-backend = "setuptools.build_meta"
[project]
name = "python-tooling-fixture"
version = "0.0.0"
dependencies = ["idna==3.11"]
requires-python = ">=3.10"
[tool.setuptools.packages.find]
where = ["src"]
[tool.uv]
required-version = "==0.13.4"
default-groups = []
[dependency-groups]
environment-check = ["packaging", "pip", "uv==0.13.4", "tomli>=2; python_version < '3.11'"]
nox = [{include-group = "environment-check"}, "nox"]
generation = [{include-group = "environment-check"}]
style = [{include-group = "environment-check"}, "'''
        + requirements["ruff"]
        + '''"]
coverage = [{include-group = "environment-check"}, "'''
        + requirements["coverage"]
        + '''"]
dev = [{include-group = "style"}, "'''
        + requirements["nox"]
        + """"]
test = [{include-group = "dev"}, {include-group = "coverage"}, """
        + ", ".join('"' + requirements[n] + '"' for n in ["pytest", "pytest-cov", "pytest-xdist", "pytest-timeout"])
        + "]\n"
        + "\n".join(
            f'''[tool.openmetadata.python-environments.profiles.{name}]
groups = ["{"environment-check" if name == "runtime" else name}"]
extras = []
install-project = {str(name in ("runtime", "dev", "test")).lower()}
'''
            for name in ["runtime", "style", "generation", "coverage", "dev", "test"]
        )
        + tools
    )
    for name in [
        "scripts/check_generated_models.py",
        "scripts/generate_ingestion_models.py",
        "scripts/datamodel_generation.py",
        "ingestion/scripts/check_python_environment.py",
    ]:
        target = root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, target)
    generated = project / "src/metadata/generated"
    generated.mkdir(parents=True, exist_ok=True)
    (generated / "__init__.py").touch()
    environment = os.environ.copy()
    for name in ["UV_PROJECT_ENVIRONMENT", "OM_PYTHON_ENVIRONMENT"]:
        environment.pop(name, None)
    result = subprocess.run(
        ["uv", "lock", "--project", str(project)],
        env=environment,
        capture_output=True,
        text=True,
        check=False,
        timeout=60,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    result = subprocess.run(
        [sys.executable, str(root / "scripts/check_generated_models.py"), "--write"],
        env=environment,
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr
