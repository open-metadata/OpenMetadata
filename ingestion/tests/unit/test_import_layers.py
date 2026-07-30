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
"""Gate the import-linter layering contract, and keep its root_packages exhaustive."""

import configparser
import os
import shutil
import subprocess
from pathlib import Path

import pytest

import metadata

_INGESTION_DIR = Path(__file__).resolve().parents[2]
_CONFIG = _INGESTION_DIR / ".importlinter"

# Namespace portions grimp cannot reach from the `metadata` root, plus dirs with no modules
# of their own. Anything else missing from root_packages would be silently unanalysed.
_NOT_ROOT_PACKAGES = frozenset({"examples", "great_expectations", "core", "domain", "profiler", "sdk", "utils"})


@pytest.fixture(scope="module")
def declared_root_packages() -> set[str]:
    parser = configparser.ConfigParser()
    parser.read(_CONFIG)
    raw = parser["importlinter"]["root_packages"]
    return {line.strip() for line in raw.splitlines() if line.strip()}


def test_layering_contract_holds():
    """`lint-imports` passes, i.e. no import crosses a layer upward outside the baseline."""
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
    """Every top-level metadata subpackage is a declared root or a known exclusion.

    grimp skips PEP 420 namespace directories nested inside a regular package, so a new
    subpackage that is neither listed nor excluded would be invisible to the contract.
    """
    package_root = Path(metadata.__file__).parent
    subpackages = {
        entry.name
        for entry in package_root.iterdir()
        if entry.is_dir() and not entry.name.startswith("__") and any(entry.rglob("*.py"))
    }
    unanalysed = {
        name
        for name in subpackages
        if f"metadata.{name}" not in declared_root_packages and name not in _NOT_ROOT_PACKAGES
    }
    assert not unanalysed, (
        f"these metadata subpackages are not covered by the import-linter contract: {sorted(unanalysed)}. "
        "Add them to root_packages in ingestion/.importlinter (namespace portions must be named "
        "explicitly) or to _NOT_ROOT_PACKAGES here if they are reachable from the metadata root."
    )
