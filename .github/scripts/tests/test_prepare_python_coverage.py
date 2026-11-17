#  Copyright 2026 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import subprocess
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

import coverage
import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "prepare_python_coverage.py"


@pytest.fixture
def project(tmp_path):
    project_dir = tmp_path / "ingestion"
    source = project_dir / "src/metadata/example.py"
    source.parent.mkdir(parents=True)
    source.write_text("first = 1\nsecond = 2\nthird = 3\n")
    (project_dir / "pyproject.toml").write_text(
        "[tool.coverage.run]\nrelative_files = true\n[tool.coverage.xml]\noutput = 'ci-coverage.xml'\n"
    )
    return project_dir


def write_coverage(path, lines):
    path.parent.mkdir(parents=True, exist_ok=True)
    data = coverage.CoverageData(basename=str(path))
    data.add_lines({"src/metadata/example.py": set(lines)})
    data.write()


def run_prepare(tmp_path):
    return subprocess.run(
        [sys.executable, str(SCRIPT)],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
    )


def line_hits(project):
    report = ET.parse(project / "ci-coverage.xml")
    return {int(line.attrib["number"]): int(line.attrib["hits"]) for line in report.findall(".//class/lines/line")}


def test_combines_unit_integration_and_connector_coverage_and_keeps_junit(tmp_path, project):
    write_coverage(tmp_path / "artifacts/coverage-unit/.coverage", [1])
    write_coverage(tmp_path / "artifacts/coverage-integration-shard-1/.coverage", [2])
    write_coverage(tmp_path / "artifacts/cli-coverage-mysql/.coverage.mysql", [3])
    for artifact, test_name in [("unit", "my_unit_test"), ("integration", "my_integration_test")]:
        report = tmp_path / "test-artifacts" / artifact / "junit/test-results.xml"
        report.parent.mkdir(parents=True)
        report.write_text(f'<testsuite><testcase name="{test_name}"/></testsuite>')

    result = run_prepare(tmp_path)

    assert result.returncode == 0, result.stdout + result.stderr
    assert line_hits(project) == {1: 1, 2: 1, 3: 1}
    names = {
        case.attrib["name"]
        for report in (project / "junit").glob("test-results-*.xml")
        for case in ET.parse(report).findall("testcase")
    }
    assert names == {"my_unit_test", "my_integration_test"}


@pytest.mark.parametrize("artifact", ["coverage-unit/.coverage", ".coverage"])
def test_partial_artifacts_produce_coverage_without_optional_test_results(tmp_path, project, artifact):
    write_coverage(tmp_path / "artifacts" / artifact, [1])

    result = run_prepare(tmp_path)

    assert result.returncode == 0, result.stdout + result.stderr
    assert line_hits(project) == {1: 1, 2: 0, 3: 0}


def test_missing_coverage_fails_before_publishing_a_report(tmp_path, project):
    result = run_prepare(tmp_path)

    assert result.returncode != 0
    assert "No Python coverage artifacts" in result.stderr
    assert not (project / "ci-coverage.xml").exists()
