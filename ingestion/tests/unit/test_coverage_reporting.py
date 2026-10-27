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
"""Regression tests for coverage report filenames consumed by SonarCloud."""

import shutil
import subprocess
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

import pytest
from coverage import CoverageData

INGESTION_DIR = Path(__file__).resolve().parents[2]
SOURCE_FILES = (
    "ingestion/source/metadata/atlas/metadata.py",
    "utils/fqn.py",
)


@pytest.fixture
def coverage_repository(tmp_path: Path) -> Path:
    module = tmp_path / "ingestion"
    module.mkdir()
    for name in ("noxfile.py", "Makefile", "pyproject.toml"):
        shutil.copyfile(INGESTION_DIR / name, module / name)
    (tmp_path / "Makefile").write_text("include ingestion/Makefile\n", encoding="utf-8")

    installed = tmp_path / "env/lib/python3.10/site-packages/metadata"
    for relative in SOURCE_FILES:
        for package in (module / "src/metadata", installed):
            source = package / relative
            source.parent.mkdir(parents=True, exist_ok=True)
            source.write_text("value = 1\n", encoding="utf-8")

    data = CoverageData(basename=str(module / ".coverage.unit"))
    data.add_lines({str(installed / relative): [1] for relative in SOURCE_FILES})
    data.write()
    return tmp_path


def assert_report_sources(module: Path) -> None:
    report = ET.parse(module / "ci-coverage.xml")
    entries = report.findall(".//class")
    assert {entry.attrib["filename"] for entry in entries} == {
        "src/metadata/ingestion/source/metadata/atlas/metadata.py",
        "src/metadata/utils/fqn.py",
    }
    for entry in entries:
        assert (module / entry.attrib["filename"]).is_file()
        line = entry.find("./lines/line")
        assert line is not None
        assert line.attrib["number"] == "1"
        assert line.attrib["hits"] == "1"


@pytest.mark.parametrize("from_root", [False, True], ids=["ingestion", "root"])
def test_nox_coverage_preserves_source_paths(coverage_repository: Path, from_root: bool) -> None:
    module = coverage_repository / "ingestion"
    cwd = coverage_repository if from_root else module
    noxfile = "ingestion/noxfile.py" if from_root else "noxfile.py"
    result = subprocess.run(
        [sys.executable, "-m", "nox", "--no-venv", "-f", noxfile, "-s", "combine-coverage"],
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert_report_sources(module)


@pytest.mark.parametrize("from_root", [False, True], ids=["ingestion", "root"])
def test_make_coverage_preserves_source_paths(coverage_repository: Path, from_root: bool) -> None:
    module = coverage_repository / "ingestion"
    cwd = coverage_repository if from_root else module
    shutil.copyfile(module / ".coverage.unit", module / ".coverage")
    # Reuse the collected artifact and exercise only the reporting recipe.
    result = subprocess.run(
        ["make", "MAKE=true", "coverage"],
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert_report_sources(module)


@pytest.mark.parametrize("from_root", [False, True], ids=["ingestion", "root"])
def test_nox_coverage_rejects_missing_data(coverage_repository: Path, from_root: bool) -> None:
    module = coverage_repository / "ingestion"
    (module / ".coverage.unit").unlink()
    (module / "ci-coverage.xml").write_text("<stale/>\n", encoding="utf-8")
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "nox",
            "--no-venv",
            "-f",
            "ingestion/noxfile.py" if from_root else "noxfile.py",
            "-s",
            "combine-coverage",
        ],
        cwd=coverage_repository if from_root else module,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    assert result.returncode != 0, result.stdout + result.stderr
    assert "No data to combine" in result.stdout + result.stderr
