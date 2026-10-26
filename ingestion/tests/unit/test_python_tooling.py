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

"""Behavioral checks for the local Python development entry points."""

import json
import os
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]


def run(*args: str, cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True, check=False, timeout=120)


def assert_success(result: subprocess.CompletedProcess) -> None:
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.fixture
def tooling_repo(tmp_path: Path, monkeypatch) -> Path:
    monkeypatch.setenv("PATH", str(Path(sys.executable).parent) + os.pathsep + os.environ["PATH"])
    monkeypatch.delenv("COVERAGE_FILE", raising=False)
    monkeypatch.delenv("COVERAGE_PROCESS_START", raising=False)
    for relative in (
        "ingestion/Makefile",
        "ingestion/noxfile.py",
        "ingestion/pyproject.toml",
    ):
        destination = tmp_path / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(REPO_ROOT / relative, destination)
    (tmp_path / "Makefile").write_text("include ingestion/Makefile\n")
    generated = tmp_path / "ingestion/src/metadata/generated"
    generated.mkdir(parents=True)
    (generated / "__init__.py").touch()
    return tmp_path


@pytest.fixture
def nox_repo(tooling_repo: Path, monkeypatch) -> Path:
    for variable in ("PYTEST_XDIST_WORKER", "PYTEST_XDIST_WORKER_COUNT", "PYTEST_XDIST_TESTRUNUID"):
        monkeypatch.delenv(variable, raising=False)
    package = tooling_repo / "ingestion/src/metadata"
    (package / "__init__.py").touch()
    (package / "sample.py").write_text(
        "def classify(value):\n    if value > 0:\n        return 'positive'\n    return 'other'\n"
    )
    for suite in ("unit", "integration"):
        tests = tooling_repo / f"ingestion/tests/{suite}"
        tests.mkdir(parents=True)
        (tests / "__init__.py").touch()
        (tests / "test_selection.py").write_text(
            f"def test_{suite}_selected():\n    pass\n\ndef test_{suite}_rejected():\n    pass\n"
        )
    monkeypatch.setenv("PYTHONPATH", str(package.parent))
    monkeypatch.setenv("PYTHON_VERSIONS", f"{sys.version_info.major}.{sys.version_info.minor}")
    monkeypatch.setenv("PYTEST_DISABLE_PLUGIN_AUTOLOAD", "1")
    monkeypatch.setenv("PYTEST_ADDOPTS", "-p pytest_cov.plugin -p xdist.plugin -p pytest_timeout")
    monkeypatch.setenv("PYTEST_XDIST_AUTO_NUM_WORKERS", "1")
    monkeypatch.setenv("PYTEST_INTEGRATION_WORKERS", "0")
    return tooling_repo


def nox_tests(repo: Path, suite: str, *args: str) -> subprocess.CompletedProcess:
    return run("nox", "--no-venv", "-s", f"{suite}-tests", "--", *args, cwd=repo / "ingestion")


def reported_test_names(repo: Path, suite: str) -> list[str]:
    report = ET.parse(repo / f"ingestion/junit/test-results-{suite}.xml")
    return [case.attrib["name"] for case in report.findall(".//testcase")]


@pytest.mark.parametrize("suite", ["unit", "integration"])
def test_nox_preserves_keyword_expression(nox_repo: Path, suite: str) -> None:
    assert_success(nox_tests(nox_repo, suite, "-k", "selected and not rejected"))

    assert reported_test_names(nox_repo, suite) == [f"test_{suite}_selected"]


@pytest.mark.parametrize("suite", ["unit", "integration"])
def test_nox_preserves_maxfail_value(nox_repo: Path, suite: str) -> None:
    (nox_repo / f"ingestion/tests/{suite}/test_selection.py").write_text(
        "def test_first_failure():\n    assert False\n\ndef test_second_failure():\n    assert False\n"
    )
    result = nox_tests(nox_repo, suite, "--maxfail", "1")

    assert result.returncode == 1, result.stdout + result.stderr
    assert reported_test_names(nox_repo, suite) == ["test_first_failure"]
    assert "1 failed" in result.stdout


@pytest.mark.parametrize("suite", ["unit", "integration"])
@pytest.mark.parametrize("path_first", [True, False])
def test_nox_explicit_path_replaces_default_suite(nox_repo: Path, suite: str, path_first: bool) -> None:
    focused = nox_repo / "ingestion/tests/focused"
    focused.mkdir()
    (focused / "test_explicit.py").write_text("def test_explicit():\n    pass\n")
    path = "tests/focused/test_explicit.py"
    flags = ["-k", "explicit"]
    args = [path, *flags] if path_first else [*flags, path]

    assert_success(nox_tests(nox_repo, suite, *args))

    assert reported_test_names(nox_repo, suite) == ["test_explicit"]


@pytest.mark.parametrize("suite", ["unit", "integration"])
def test_nox_defaults_to_requested_suite(nox_repo: Path, suite: str) -> None:
    assert_success(nox_tests(nox_repo, suite))

    assert sorted(reported_test_names(nox_repo, suite)) == [f"test_{suite}_rejected", f"test_{suite}_selected"]


@pytest.mark.parametrize("workers", ["0", "1"])
def test_nox_integration_owned_options_reset_coverage(nox_repo: Path, workers: str, monkeypatch) -> None:
    (nox_repo / "ingestion/tests/integration/test_selection.py").write_text(
        "import os\nfrom metadata.sample import classify\n\n"
        "def test_positive():\n    assert classify(1) == 'positive'\n\n"
        "def test_other():\n    assert classify(0) == 'other'\n"
        f"    assert os.environ.get('PYTEST_XDIST_WORKER') == {('gw0' if workers == '1' else None)!r}\n"
    )
    assert_success(nox_tests(nox_repo, "integration", "-k", "positive"))
    monkeypatch.setenv("PYTEST_INTEGRATION_WORKERS", "invalid-unless-overridden")

    assert_success(
        nox_tests(nox_repo, "integration", "-k", "other", "--standalone", "--workers", workers, "--maxfail", "1")
    )

    assert reported_test_names(nox_repo, "integration") == ["test_other"]
    assert_success(run("coverage", "json", "--rcfile=pyproject.toml", cwd=nox_repo / "ingestion"))
    report = json.loads((nox_repo / "ingestion/coverage.json").read_text())
    sample = report["files"]["src/metadata/sample.py"]
    assert 3 in sample["missing_lines"]
    assert 4 in sample["executed_lines"]


@pytest.mark.parametrize("directory", [".", "ingestion"])
def test_pytest_collects_mlflow_from_both_entry_points(nox_repo: Path, directory: str) -> None:
    (nox_repo / "ingestion/tests/unit/test_active.py").write_text("def test_active():\n    pass\n")
    mlflow_test = nox_repo / "ingestion/tests/integration/sources/mlmodels/mlflow/test_mlflow.py"
    mlflow_test.parent.mkdir(parents=True)
    mlflow_test.write_text("def test_mlflow():\n    pass\n")
    (mlflow_test.parent / "test_mlflow_neighbor.py").write_text("def test_neighbor():\n    pass\n")
    prefix = "ingestion/" if directory == "." else ""
    result = run(
        sys.executable,
        "-m",
        "pytest",
        "-c",
        prefix + "pyproject.toml",
        prefix + "tests/unit",
        prefix + "tests/integration",
        "--junitxml=" + str(nox_repo / "collection.xml"),
        cwd=nox_repo / directory,
    )

    assert_success(result)
    report = ET.parse(nox_repo / "collection.xml")
    names = [case.attrib["name"] for case in report.findall(".//testcase")]
    assert sorted(names) == [
        "test_active",
        "test_integration_rejected",
        "test_integration_selected",
        "test_mlflow",
        "test_neighbor",
        "test_unit_rejected",
        "test_unit_selected",
    ]


@pytest.mark.parametrize("directory", [".", "ingestion"])
def test_make_coverage_combines_unit_and_integration(tooling_repo: Path, directory: str, monkeypatch) -> None:
    package = tooling_repo / "ingestion/src/metadata"
    (package / "__init__.py").touch()
    (package / "sample.py").write_text(
        "def classify(value):\n    if value > 0:\n        return 'positive'\n    return 'other'\n"
    )
    for suite, value, expected in (("unit", 1, "positive"), ("integration", 0, "other")):
        tests = tooling_repo / f"ingestion/tests/{suite}"
        tests.mkdir(parents=True)
        (tests / f"test_{suite}.py").write_text(
            f"from metadata.sample import classify\n\ndef test_classify():\n    assert classify({value}) == {expected!r}\n"
        )
    monkeypatch.setenv("PYTHONPATH", str(package.parent))
    monkeypatch.setenv("PYTHON_VERSIONS", f"{sys.version_info.major}.{sys.version_info.minor}")
    monkeypatch.setenv("PYTEST_DISABLE_PLUGIN_AUTOLOAD", "1")
    monkeypatch.setenv("PYTEST_ADDOPTS", "-p pytest_cov.plugin -p xdist.plugin -p pytest_timeout")
    monkeypatch.setenv("PYTEST_XDIST_AUTO_NUM_WORKERS", "1")
    monkeypatch.setenv("PYTEST_INTEGRATION_WORKERS", "0")

    assert_success(run("make", "coverage", cwd=tooling_repo / directory))

    report = ET.parse(tooling_repo / "ingestion/ci-coverage.xml").getroot()
    sample = report.find(".//class[@name='sample.py']")
    assert sample is not None
    assert sample.attrib["line-rate"] == "1"
    assert sample.attrib["branch-rate"] == "1"
    assert (tooling_repo / "ingestion/.coverage").is_file()
    assert not (tooling_repo / ".coverage").exists()


@pytest.mark.parametrize("directory", [".", "ingestion"])
@pytest.mark.parametrize("target", ["run_python_tests", "coverage"])
def test_make_coverage_rejects_missing_data(tooling_repo: Path, directory: str, target: str) -> None:
    # A prior successful run must not make an empty run look successful.
    (tooling_repo / "ingestion/coverage.xml").write_text("<stale/>\n")
    if target == "run_python_tests":
        (tooling_repo / "ingestion/stale.py").write_text("VALUE = 1\n")
        assert_success(
            run(
                sys.executable,
                "-c",
                "from coverage import CoverageData; data = CoverageData(); "
                "data.add_arcs({'stale.py': [(-1, 1), (1, -1)]}); data.write()",
                cwd=tooling_repo / "ingestion",
            )
        )

    result = run("make", "MAKE=true", target, cwd=tooling_repo / directory)

    assert result.returncode != 0, result.stdout + result.stderr
    assert "No data to report" in result.stdout + result.stderr
