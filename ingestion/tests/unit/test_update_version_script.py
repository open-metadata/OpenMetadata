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
def checkout(tmp_path: Path) -> Path:
    ingestion = tmp_path / "ingestion"
    ingestion.mkdir()
    (ingestion / "pyproject.toml").write_text(
        '[build-system]\nrequires=["setuptools>=83"]\nbuild-backend="setuptools.build_meta"\n'
        '[project]\nname="openmetadata-ingestion"\nversion = "2.0.0.0.dev0"\n'
        'requires-python=">=3.10"\ndynamic=["dependencies"]\n'
        '[dependency-groups]\nnox=["uv==0.13.4", "nox", "tomli; python_version < \'3.11\'"]\n'
        '[tool.uv]\nrequired-version="==0.13.4"\ndefault-groups=[]\n'
        '[[tool.uv.dependency-metadata]]\nname="sqlalchemy-ibmi"\nversion = "0.9.3"\n'
        'requires-dist=["pyodbc>=4.0", "sqlalchemy>=2.0,<2.1"]\n',
        encoding="utf-8",
    )
    (ingestion / "setup.py").write_text(
        'from setuptools import setup\nsetup(install_requires=["packaging==26.3"])\n', encoding="utf-8"
    )
    subprocess.run(
        [str(Path(sys.executable).with_name("uv")), "lock", "--project", str(ingestion)],
        check=True,
        capture_output=True,
        text=True,
    )
    apis = tmp_path / "openmetadata-airflow-apis"
    apis.mkdir()
    (apis / "pyproject.toml").write_text(
        '[project]\nname="openmetadata-managed-apis"\nversion = "2.0.0.0.dev0"\n', encoding="utf-8"
    )
    scripts = tmp_path / "scripts"
    scripts.mkdir()
    shutil.copy2(ROOT / "scripts/update_version.py", scripts / "update_version.py")
    shutil.copy2(ROOT / "Makefile", tmp_path / "Makefile")
    shutil.copy2(ROOT / "ingestion/Makefile", ingestion / "Makefile")
    return tmp_path


def run_update(checkout: Path, version: str, project="ingestion"):
    return subprocess.run(
        [
            sys.executable,
            "scripts/update_version.py",
            "update_pyproject_version",
            "--file-path",
            f"{project}/pyproject.toml",
            "--version",
            version,
        ],
        cwd=checkout,
        capture_output=True,
        text=True,
        check=False,
        timeout=120,
    )


def read_toml(path: Path):
    return tomllib.loads(path.read_text(encoding="utf-8"))


def snapshot(checkout: Path):
    return {
        str(path.relative_to(checkout)): path.read_bytes()
        for path in checkout.rglob("*")
        if path.name in ("pyproject.toml", "uv.lock", "setup.py")
    }


def test_version_update_preserves_metadata_and_third_party_records(checkout):
    ingestion = checkout / "ingestion"
    original = read_toml(ingestion / "uv.lock")
    result = run_update(checkout, "2.0.1234")
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
    after = snapshot(checkout)
    result = run_update(checkout, "2.0.1234")
    assert result.returncode == 0, result.stdout + result.stderr
    assert snapshot(checkout) == after


def test_public_make_updates_sdk_and_apis(checkout):
    result = subprocess.run(
        ["make", "update_pyproject_version", "RELEASE_VERSION=2.0.1234"],
        cwd=checkout,
        capture_output=True,
        text=True,
        check=False,
        timeout=180,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert read_toml(checkout / "ingestion/pyproject.toml")["project"]["version"] == "2.0.1234.0"
    assert read_toml(checkout / "openmetadata-airflow-apis/pyproject.toml")["project"]["version"] == "2.0.1234.0"
    assert not (checkout / "env").exists()


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


def test_make_propagates_update_failure(checkout):
    metadata = checkout / "ingestion/pyproject.toml"
    metadata.write_text(
        metadata.read_text(encoding="utf-8").replace('version = "2.0.0.0.dev0"', 'version = "invalid"'),
        encoding="utf-8",
    )
    result = subprocess.run(
        ["make", "update_pyproject_version", "RELEASE_VERSION=2.0.1234"],
        cwd=checkout,
        capture_output=True,
        text=True,
        check=False,
        timeout=180,
    )
    assert result.returncode != 0
    assert read_toml(checkout / "openmetadata-airflow-apis/pyproject.toml")["project"]["version"] == "2.0.0.0.dev0"
