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
import runpy
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
UV_VERSION = runpy.run_path(str(ROOT / "scripts/python_tools.py"))["required_version"]()


def prepare_locked_tooling(root, monkeypatch):
    """Copy the command implementation and lock only the fixture's tools."""
    for name in [
        "OM_PYTHON_ENVIRONMENT",
        "OM_VENV_DIR",
        "OM_UV_EXECUTABLE",
        "UV_PROJECT_ENVIRONMENT",
        "ARGS",
        "MAKEFLAGS",
        "MFLAGS",
        "MAKEOVERRIDES",
        "MAKELEVEL",
    ]:
        monkeypatch.delenv(name, raising=False)
    selected_uv = subprocess.run(
        [sys.executable, str(ROOT / "scripts/python_tools.py"), "uv-path"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert selected_uv.returncode == 0, selected_uv.stdout + selected_uv.stderr
    monkeypatch.setenv("PATH", str(Path(selected_uv.stdout.strip()).parent) + os.pathsep + os.environ["PATH"])
    project = root / "ingestion"
    config = project / "pyproject.toml"
    sections = re.split(r"(?m)(?=^\[)", config.read_text())
    tools = "".join(
        s for s in sections if s.startswith(("[tool.pytest", "[tool.coverage", "[tool.ruff", "[tool.basedpyright"))
    )
    environment_policy = "".join(s for s in sections if s.startswith("[tool.openmetadata.python-environments]"))
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
            "pip",
            "basedpyright",
        ]
    }
    config.write_text(
        """[build-system]
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
required-version = "=="""
        + UV_VERSION
        + '''"
default-groups = []
[dependency-groups]
bootstrap = ["pip", "tomli>=2; python_version < '3.11'"]
nox = [{include-group = "bootstrap"}, "nox"]
generation = [{include-group = "bootstrap"}]
style = [{include-group = "bootstrap"}, "'''
        + requirements["ruff"]
        + '''"]
typing = [{include-group = "bootstrap"}, "'''
        + requirements["basedpyright"]
        + '''"]
coverage = [{include-group = "bootstrap"}, "'''
        + requirements["coverage"]
        + '''"]
dev = [{include-group = "style"}, "'''
        + requirements["nox"]
        + """"]
test = [{include-group = "dev"}, {include-group = "coverage"}, """
        + ", ".join('"' + requirements[n] + '"' for n in ["pytest", "pytest-cov", "pytest-xdist", "pytest-timeout"])
        + "]\n"
        + environment_policy
        + "\n".join(
            f'''[tool.openmetadata.python-environments.profiles.{name}]
groups = ["{"bootstrap" if name == "runtime" else "test" if name == "test-classification" else "typing" if name == "types" else name}"]
extras = []
install-project = {str(name in ("runtime", "dev", "test", "test-classification", "types")).lower()}
'''
            for name in ["runtime", "style", "generation", "coverage", "dev", "test", "test-classification", "types"]
        )
        + tools
    )
    for name in [
        "scripts/check_generated_models.py",
        "scripts/generate_ingestion_models.py",
        "scripts/datamodel_generation.py",
        "scripts/prepare_classification_models.py",
        "scripts/python_tools.py",
        "openmetadata-spec/scripts/prepare_model_schemas.py",
    ]:
        target = root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, target)
    generated = project / "src/metadata/generated"
    generated.mkdir(parents=True, exist_ok=True)
    (generated / "__init__.py").touch()
    baseline = project / ".basedpyright/baseline.json"
    baseline.parent.mkdir()
    baseline.write_text('{"files": {}}\n')
    (project / "stubs").mkdir()
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
