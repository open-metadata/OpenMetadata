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
"""Check package version updates preserve locked dependency metadata."""

import os
import runpy
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

try:
    import tomllib
except ImportError:
    import tomli as tomllib

ROOT = Path(__file__).resolve().parents[3]


@pytest.fixture
def checkout(tmp_path: Path, monkeypatch) -> Path:
    tools = runpy.run_path(str(ROOT / "scripts/python_tools.py"))
    uv = str(tools["ensure_uv"]())
    uv_version = tools["required_version"]()
    monkeypatch.setenv("OM_UV_EXECUTABLE", uv)
    ingestion = tmp_path / "ingestion"
    ingestion.mkdir()
    (ingestion / "pyproject.toml").write_text(
        '[build-system]\nrequires=["setuptools>=83"]\nbuild-backend="setuptools.build_meta"\n'
        '[project]\nname="openmetadata-ingestion"\nversion = "2.0.0.0.dev0"\n'
        'requires-python=">=3.10"\ndynamic=["dependencies"]\n'
        '[dependency-groups]\nnox=["nox", "tomli; python_version < \'3.11\'"]\n'
        f'[tool.uv]\nrequired-version="=={uv_version}"\ndefault-groups=[]\n'
        '[[tool.uv.dependency-metadata]]\nname="sqlalchemy-ibmi"\nversion = "0.9.3"\n'
        'requires-dist=["pyodbc>=4.0", "sqlalchemy>=2.0,<2.1"]\n',
        encoding="utf-8",
    )
    (ingestion / "setup.py").write_text(
        'from setuptools import setup\nsetup(install_requires=["packaging==26.3"])\n', encoding="utf-8"
    )
    subprocess.run(
        [uv, "lock", "--project", str(ingestion)],
        check=True,
        capture_output=True,
        text=True,
    )
    apis = tmp_path / "openmetadata-airflow-apis"
    apis.mkdir()
    (apis / "pyproject.toml").write_text(
        '[build-system]\nrequires=["setuptools>=83"]\nbuild-backend="setuptools.build_meta"\n'
        '[project]\nname="openmetadata_managed_apis"\nversion = "2.0.0.0.dev0"\n'
        'requires-python=">=3.10"\ndependencies=["openmetadata-ingestion"]\n'
        '[tool.uv.sources]\nopenmetadata-ingestion={path="../ingestion", editable=true}\n',
        encoding="utf-8",
    )
    subprocess.run(
        [uv, "lock", "--project", str(apis)],
        check=True,
        capture_output=True,
        text=True,
    )
    scripts = tmp_path / "scripts"
    scripts.mkdir()
    shutil.copy2(ROOT / "scripts/update_version.py", scripts / "update_version.py")
    shutil.copy2(ROOT / "scripts/python_tools.py", scripts / "python_tools.py")
    shutil.copy2(ROOT / "Makefile", tmp_path / "Makefile")
    shutil.copy2(ROOT / "ingestion/Makefile", ingestion / "Makefile")
    return tmp_path


def run_update(checkout: Path, version: str):
    return subprocess.run(
        [
            sys.executable,
            "scripts/update_version.py",
            "update_pyproject_version",
            "--file-path",
            "ingestion/pyproject.toml",
            "--version",
            version,
        ],
        cwd=checkout,
        capture_output=True,
        text=True,
        check=False,
        timeout=120,
    )


def run_make(checkout: Path, target: str):
    return subprocess.run(
        ["make", target, "RELEASE_VERSION=2.0.1234"],
        cwd=checkout,
        capture_output=True,
        text=True,
        check=False,
        timeout=180,
    )


def read_toml(path: Path):
    return tomllib.loads(path.read_text(encoding="utf-8"))


def snapshot(checkout: Path):
    return {
        str(path.relative_to(checkout)): path.read_bytes()
        for path in checkout.rglob("*")
        if path.name in ("pyproject.toml", "uv.lock", "setup.py")
    }


def test_public_make_updates_both_packages_without_changing_dependencies(checkout, monkeypatch):
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    ingestion = checkout / "ingestion"
    apis = checkout / "openmetadata-airflow-apis"
    original = read_toml(ingestion / "uv.lock")
    original_apis = read_toml(apis / "uv.lock")
    result = run_make(checkout, "update_pyproject_version")
    assert result.returncode == 0, result.stdout + result.stderr
    metadata = read_toml(ingestion / "pyproject.toml")
    assert metadata["project"]["version"] == "2.0.1234.0"
    assert metadata["tool"]["uv"]["dependency-metadata"][0]["version"] == "0.9.3"
    updated = read_toml(ingestion / "uv.lock")
    assert original["manifest"] == updated["manifest"]
    assert [p for p in original["package"] if "registry" in p["source"]] == [
        p for p in updated["package"] if "registry" in p["source"]
    ]
    assert next(p for p in updated["package"] if p["name"] == "openmetadata-ingestion")["version"] == "2.0.1234.0"
    assert read_toml(apis / "pyproject.toml")["project"]["version"] == "2.0.1234.0"
    for package in original_apis["package"]:
        if package["name"] in {"openmetadata-managed-apis", "openmetadata-ingestion"}:
            package["version"] = "2.0.1234.0"
    assert read_toml(apis / "uv.lock") == original_apis
    after = snapshot(checkout)
    result = run_make(checkout, "update_pyproject_version")
    assert result.returncode == 0, result.stdout + result.stderr
    assert snapshot(checkout) == after
    assert not (checkout / "env").exists()
    assert not (checkout / "ingestion/.nox/bootstrap/bin/uv").exists()


def test_release_stops_after_an_update_failure(checkout, monkeypatch):
    commands = checkout / "commands"
    commands.mkdir()
    maven = commands / "mvn"
    maven.write_text(
        f"#!{sys.executable}\nfrom pathlib import Path\nPath('maven-called').touch()\nraise SystemExit(1)\n"
    )
    maven.chmod(0o755)
    (checkout / "scripts/update_version.py").write_text("from pathlib import Path\nPath('later-update').touch()\n")
    monkeypatch.setenv("PATH", str(commands) + os.pathsep + os.environ["PATH"])
    before = snapshot(checkout)
    result = run_make(checkout, "update_all")
    assert result.returncode != 0, result.stdout + result.stderr
    assert (checkout / "maven-called").is_file()
    assert not (checkout / "later-update").exists()
    assert snapshot(checkout) == before


@pytest.mark.parametrize("broken", ["invalid-version", "changed-dependency"])
def test_invalid_update_does_not_change_inputs(checkout, broken):
    version = "invalid" if broken == "invalid-version" else "2.0.1234"
    if broken == "changed-dependency":
        setup = checkout / "ingestion/setup.py"
        setup.write_text(
            setup.read_text(encoding="utf-8").replace("packaging==26.3", "packaging==25.0"), encoding="utf-8"
        )
    before = snapshot(checkout)
    result = run_update(checkout, version)
    assert result.returncode != 0
    assert snapshot(checkout) == before


def test_make_rejects_a_stale_airflow_lock_before_updating_either_project(checkout):
    project = checkout / "openmetadata-airflow-apis/pyproject.toml"
    project.write_text(
        project.read_text().replace(
            'dependencies=["openmetadata-ingestion"]', 'dependencies=["openmetadata-ingestion", "packaging<26"]'
        )
    )
    before = snapshot(checkout)
    result = run_make(checkout, "update_pyproject_version")
    assert result.returncode != 0, result.stdout + result.stderr
    assert snapshot(checkout) == before
