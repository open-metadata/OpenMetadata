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

import os
import shutil
import subprocess
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

import pytest
from coverage import CoverageData

from ingestion.tests.utils.python_tooling import prepare_locked_tooling

INGESTION_DIR = Path(__file__).resolve().parents[2]
SOURCE_FILES = (
    "ingestion/source/metadata/atlas/metadata.py",
    "utils/fqn.py",
)


@pytest.fixture
def coverage_repository(tmp_path: Path, monkeypatch) -> Path:
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
    prepare_locked_tooling(tmp_path, monkeypatch)
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


@pytest.fixture(params=["src", "env/lib/python3.10/site-packages"])
def recorded_coverage(tmp_path: Path, request, monkeypatch):
    monkeypatch.delenv("COVERAGE_FILE", raising=False)
    monkeypatch.delenv("COVERAGE_PROCESS_START", raising=False)
    project = tmp_path / "ingestion"
    source = project / "src/metadata"
    source.mkdir(parents=True)
    (source / "__init__.py").touch()
    (source / "sample.py").write_text("def double(value):\n    return value * 2\n")
    package = project / request.param / "metadata"
    if package != source:
        shutil.copytree(source, package)
    temporary = tmp_path / "temporary"
    connector = temporary / "test_binding"
    connector.mkdir(parents=True)
    (connector / "__init__.py").touch()
    (connector / "resolution.py").write_text("VALUE = 1\n")
    probe = project / "probe.py"
    probe.write_text(
        "import metadata\n"
        f"metadata.__path__.append({str(temporary)!r})\n"
        "from metadata.test_binding.resolution import VALUE\n"
        "from metadata.sample import double\n"
        "assert double(VALUE) == 2\n"
    )
    environment = {**os.environ, "PYTHONPATH": str(package.parent)}

    def run_coverage(*arguments):
        return subprocess.run(
            [
                sys.executable,
                "-m",
                "coverage",
                arguments[0],
                f"--rcfile={INGESTION_DIR / 'pyproject.toml'}",
                *arguments[1:],
            ],
            cwd=project,
            env=environment,
            capture_output=True,
            text=True,
            check=False,
            timeout=30,
        )

    result = run_coverage("run", str(probe))
    assert result.returncode == 0, result.stdout + result.stderr
    data = CoverageData(basename=str(next(project.glob(".coverage.*"))))
    data.read()
    assert str(connector / "resolution.py") in data.measured_files()
    return project, temporary, run_coverage


def test_reports_exclude_temporary_modules_before_and_after_combining(recorded_coverage):
    project, temporary, run_coverage = recorded_coverage
    # Unit jobs report before transfer; the combine job has only the checkout and artifacts.
    partial = next(project.glob(".coverage.*"))
    result = run_coverage("xml", f"--data-file={partial}", "-o", "unit.xml")
    assert result.returncode == 0, result.stdout + result.stderr
    unit_report = ET.parse(project / "unit.xml")
    assert [entry.attrib["name"] for entry in unit_report.findall(".//class")] == ["sample.py"]

    shutil.rmtree(temporary)
    result = run_coverage("combine")
    assert result.returncode == 0, result.stdout + result.stderr
    for command in ("report", "xml"):
        result = run_coverage(command)
        assert result.returncode == 0, result.stdout + result.stderr
    report = ET.parse(project / "ci-coverage.xml")
    classes = report.findall(".//class")
    assert [entry.attrib["name"] for entry in classes] == ["sample.py"]
    assert classes[0].attrib["line-rate"] == "1"


def test_reports_still_reject_missing_application_sources(recorded_coverage):
    project, temporary, run_coverage = recorded_coverage
    shutil.rmtree(temporary)
    result = run_coverage("combine")
    assert result.returncode == 0, result.stdout + result.stderr
    (project / "src/metadata/sample.py").unlink()
    result = run_coverage("report")
    assert result.returncode != 0
    assert "No source for code" in result.stdout + result.stderr
    assert "sample.py" in result.stdout + result.stderr
