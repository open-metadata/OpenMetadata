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

"""Check whether generated ingestion models match their generation inputs."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
GENERATED_ROOT = ROOT / "ingestion/src/metadata/generated"
MANIFEST = GENERATED_ROOT / ".generation-manifest.json"
MANIFEST_VERSION = 1

INPUT_ROOTS = (
    ROOT / "openmetadata-spec/src/main/resources/json/schema",
    ROOT / "openmetadata-spec/src/main/antlr4",
)
INPUT_FILES = (
    ROOT / "Makefile",
    ROOT / "ingestion/pyproject.toml",
    ROOT / "scripts/datamodel_generation.py",
    Path(__file__).resolve(),
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file_:
        for chunk in iter(lambda: file_.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def input_paths() -> list[Path]:
    paths = set(INPUT_FILES)
    for root in INPUT_ROOTS:
        paths.update(path for path in root.rglob("*") if path.is_file())
    return sorted(paths)


def generated_paths() -> list[Path]:
    if not GENERATED_ROOT.exists():
        return []
    return sorted(
        path
        for path in GENERATED_ROOT.rglob("*")
        if path.is_file()
        and path != MANIFEST
        and "__pycache__" not in path.parts
        and path.suffix != ".pyc"
    )


def hashes(paths: Iterable[Path]) -> dict[str, str]:
    return {relative(path): sha256(path) for path in paths}


def current_manifest() -> dict[str, object]:
    return {
        "version": MANIFEST_VERSION,
        "inputs": hashes(input_paths()),
        "outputs": hashes(generated_paths()),
    }


def changed_paths(
    expected: dict[str, str], actual: dict[str, str]
) -> tuple[list[str], list[str], list[str]]:
    expected_paths = set(expected)
    actual_paths = set(actual)
    added = sorted(actual_paths - expected_paths)
    removed = sorted(expected_paths - actual_paths)
    changed = sorted(
        path for path in expected_paths & actual_paths if expected[path] != actual[path]
    )
    return added, removed, changed


def report_difference(
    label: str, expected: dict[str, str], actual: dict[str, str]
) -> bool:
    added, removed, changed = changed_paths(expected, actual)
    if not any((added, removed, changed)):
        return False
    print(f"{label} changed:")
    for category, paths in (
        ("added", added),
        ("removed", removed),
        ("modified", changed),
    ):
        for path in paths:
            print(f"  {category}: {path}")
    return True


def check() -> int:
    if not MANIFEST.exists():
        print(f"Generated-model manifest is missing: {MANIFEST}")
        return 1

    expected = json.loads(MANIFEST.read_text(encoding="utf-8"))
    actual = current_manifest()
    stale = expected.get("version") != MANIFEST_VERSION
    stale |= report_difference(
        "Generation inputs", expected.get("inputs", {}), actual["inputs"]
    )
    stale |= report_difference(
        "Generated outputs", expected.get("outputs", {}), actual["outputs"]
    )
    if stale:
        return 1

    print("Generated models are up to date.")
    return 0


def write() -> int:
    if not generated_paths():
        print("Cannot write generated-model manifest: generated files are missing.")
        return 1
    MANIFEST.write_text(
        json.dumps(current_manifest(), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote generated-model manifest: {MANIFEST}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--check", action="store_true")
    action.add_argument("--write", action="store_true")
    args = parser.parse_args()
    return check() if args.check else write()


if __name__ == "__main__":
    raise SystemExit(main())
