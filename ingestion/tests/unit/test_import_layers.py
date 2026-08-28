#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Checks on the import-linter layering contract in ingestion/.importlinter."""

import configparser
import os
import shutil
import subprocess
from pathlib import Path

import pytest

import metadata

_INGESTION_DIR = Path(__file__).resolve().parents[2]
_CONFIG = _INGESTION_DIR / ".importlinter"

# Regular packages, so grimp reaches them by walking the `metadata` root and they do not
# need declaring. Every other subpackage is a namespace portion and must be declared.
_REACHED_VIA_METADATA_ROOT = frozenset({"core", "domain", "great_expectations", "profiler", "sdk", "utils"})

# Spans layers: custom_pydantic sits below metadata.generated because every generated model
# imports it, while the rest is framework-level. Layering it would need overlapping layers.
_INTENTIONALLY_UNLAYERED = frozenset({"metadata.ingestion.models"})


@pytest.fixture(scope="module")
def config() -> configparser.ConfigParser:
    parser = configparser.ConfigParser()
    parser.read(_CONFIG)
    return parser


@pytest.fixture(scope="module")
def declared_root_packages(config) -> set[str]:
    return {line.strip() for line in config["importlinter"]["root_packages"].splitlines() if line.strip()}


@pytest.fixture(scope="module")
def layered_modules(config) -> set[str]:
    """Fully qualified module names appearing in the layers contract."""
    contract = config["importlinter:contract:layers"]
    containers = [line.strip() for line in contract["containers"].splitlines() if line.strip()]
    tails = {module.strip() for line in contract["layers"].splitlines() for module in line.split(":") if module.strip()}
    return {f"{container}.{tail}" for container in containers for tail in tails}


def test_layering_contract_holds():
    """No import crosses a layer upward outside the recorded baseline."""
    if shutil.which("lint-imports") is None:
        pytest.skip("import-linter not installed")
    result = subprocess.run(
        ["lint-imports"],
        cwd=_INGESTION_DIR,
        capture_output=True,
        text=True,
        check=False,
        env={**os.environ, "COLUMNS": "400"},
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_every_metadata_subpackage_is_analysed(declared_root_packages):
    """Every metadata subpackage holding modules is declared as a root, or reached via one."""
    package_root = Path(metadata.__file__).parent
    subpackages = {
        entry.name
        for entry in package_root.iterdir()
        if entry.is_dir() and not entry.name.startswith("__") and any(entry.rglob("*.py"))
    }
    unanalysed = {
        name
        for name in subpackages
        if f"metadata.{name}" not in declared_root_packages and name not in _REACHED_VIA_METADATA_ROOT
    }
    assert not unanalysed, (
        f"{sorted(unanalysed)} would not be analysed by the layering contract. Add them to "
        "root_packages in ingestion/.importlinter."
    )


def test_every_ingestion_subpackage_has_a_layer(layered_modules):
    """Every metadata.ingestion subpackage is assigned to a layer, or excused above."""
    ingestion_root = Path(metadata.__file__).parent / "ingestion"
    subpackages = {
        f"metadata.ingestion.{entry.name}"
        for entry in ingestion_root.iterdir()
        if entry.is_dir() and not entry.name.startswith("__") and any(entry.rglob("*.py"))
    }
    unlayered = subpackages - layered_modules - _INTENTIONALLY_UNLAYERED
    assert not unlayered, (
        f"{sorted(unlayered)} sit outside every layer, so imports to and from them are "
        "unconstrained. Add them to a layer in ingestion/.importlinter."
    )
