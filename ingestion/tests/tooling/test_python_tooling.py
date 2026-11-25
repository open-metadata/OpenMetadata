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

import fcntl
import functools
import hashlib
import http.server
import importlib.metadata
import json
import os
import select
import shutil
import subprocess
import sys
import threading
import xml.etree.ElementTree as ET
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
import yaml

from ingestion.tests.utils.python_tooling import UV_VERSION, prepare_locked_tooling

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
    prepare_locked_tooling(tmp_path, monkeypatch)
    return tmp_path


@pytest.fixture
def nox_repo(tooling_repo: Path, monkeypatch) -> Path:
    for variable in ("PYTEST_XDIST_WORKER", "PYTEST_XDIST_WORKER_COUNT", "PYTEST_XDIST_TESTRUNUID"):
        monkeypatch.delenv(variable, raising=False)
    package = tooling_repo / "ingestion/src/metadata"
    (package / "__init__.py").touch()
    (package / "sample.py").write_text(
        "def classify(value: int) -> str:\n    if value > 0:\n        return 'positive'\n    return 'other'\n"
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


@pytest.mark.parametrize(
    "directory, target, ci, exit_code",
    [
        ("module", "coverage", True, 0),
        ("root", "coverage_apis", False, 0),
        ("root", "run_apis_tests", True, 1),
        ("module", "test", True, 5),
    ],
)
def test_airflow_make_preserves_selection_status_and_coverage(
    tooling_repo, monkeypatch, directory, target, ci, exit_code
):
    project = tooling_repo / "openmetadata-airflow-apis"
    project.mkdir()
    for name in ("Makefile", "noxfile.py"):
        shutil.copyfile(REPO_ROOT / "openmetadata-airflow-apis" / name, project / name)
    tools = [
        f"{name}=={importlib.metadata.version(name)}" for name in ("nox", "pytest", "pytest-cov", "pytest-timeout")
    ]
    (project / "pyproject.toml").write_text(
        '[build-system]\nrequires=["setuptools==83.0.0"]\nbuild-backend="setuptools.build_meta"\n'
        '[project]\nname="api-tooling-fixture"\nversion="0.0.0"\nrequires-python=">=3.10"\n'
        "[dependency-groups]\ntest=" + json.dumps(tools) + "\n"
        '[tool.setuptools.packages.find]\ninclude=["openmetadata_managed_apis"]\n'
        '[tool.pytest.ini_options]\ntestpaths=["tests"]\n'
        '[tool.coverage.run]\nsource=["openmetadata_managed_apis"]\nrelative_files=true\nbranch=true\n'
    )
    package = project / "openmetadata_managed_apis"
    package.mkdir()
    (package / "__init__.py").write_text('def classify(value):\n    return "positive" if value > 0 else "other"\n')
    tests = project / "tests"
    tests.mkdir()
    (tests / "test_selection.py").write_text(
        "from openmetadata_managed_apis import classify\n"
        "def test_selected():\n    assert classify(1) == 'positive'\n"
        f"    assert {exit_code != 1!r}\n"
        "def test_selected_rejected():\n    raise AssertionError('unselected')\n"
    )
    monkeypatch.setenv("GITHUB_ACTIONS", "true" if ci else "false")
    monkeypatch.delenv("PYTEST_ADDOPTS", raising=False)
    assert_success(run("uv", "lock", "--project", str(project), cwd=tooling_repo))
    selection = "missing and not rejected" if exit_code == 5 else "selected and not rejected"
    result = run(
        "make",
        target,
        f"PYTHON={sys.executable}",
        f'ARGS=tests/test_selection.py -k "{selection}"',
        cwd=project if directory == "module" else tooling_repo,
    )
    assert (result.returncode == 0) == (exit_code == 0), result.stdout + result.stderr
    assert (project / "airflow-apis-test-exit-code.txt").read_text().strip() == str(exit_code)
    report = ET.parse(project / "junit/test-results-airflow-apis.xml")
    assert [case.attrib["name"] for case in report.findall(".//testcase")] == (
        [] if exit_code == 5 else ["test_selected"]
    )
    coverage = "coverage" in target
    assert (project / "ci-coverage.xml").is_file() == coverage
    assert ("TOTAL" in result.stdout) == (coverage and not ci)


@pytest.mark.parametrize("suite", ["unit", "integration"])
@pytest.mark.parametrize("collect, exit_code", [(False, 0), (True, 0), (True, 1)])
def test_ci_suite_collects_coverage_only_when_selected(
    nox_repo: Path, monkeypatch, suite: str, collect: bool, exit_code: int
) -> None:
    from coverage import CoverageData

    test = nox_repo / f"ingestion/tests/{suite}/test_selection.py"
    test.write_text(
        "import subprocess, sys\nfrom metadata.sample import classify\n\ndef test_selected():\n"
        "    subprocess.run([sys.executable, '-c', "
        "\"from metadata.sample import classify; assert classify(-1) == 'other'\"], check=True)\n"
        f"    assert classify(1) == {'positive' if exit_code == 0 else 'other'!r}\n"
    )
    action = yaml.safe_load((REPO_ROOT / ".github/actions/python-suite/action.yml").read_text())
    script = next(step["run"] for step in action["runs"]["steps"] if "run" in step)
    monkeypatch.setenv("SUITE", suite)
    monkeypatch.setenv("NOX_ARGS", "-n 1" if suite == "unit" else "--standalone")
    monkeypatch.setenv("COLLECT_COVERAGE", "true" if collect else "false")

    assert_success(run("make", "install_test", cwd=nox_repo))
    result = run("bash", "-eo", "pipefail", "-c", script, cwd=nox_repo)
    assert result.returncode == exit_code, result.stdout + result.stderr
    assert "TOTAL" not in result.stdout

    assert reported_test_names(nox_repo, suite) == ["test_selected"]
    coverage_file = nox_repo / "ingestion/.coverage"
    assert coverage_file.is_file() == collect
    if collect:
        data = CoverageData(str(coverage_file))
        data.read()
        assert data.has_arcs()
        assert data.lines("src/metadata/sample.py") == [1, 2, 3, 4]
        assert (2, 3) in data.arcs("src/metadata/sample.py")
        assert (2, 4) in data.arcs("src/metadata/sample.py")


@pytest.mark.parametrize("profile", ["dev", "test", "types", "style"])
def test_ci_python_action_installs_the_locked_selection(nox_repo: Path, monkeypatch, profile: str) -> None:
    action = yaml.safe_load((REPO_ROOT / ".github/actions/prepare-python-environment/action.yml").read_text())
    install = next(step["run"] for step in action["runs"]["steps"] if step.get("name") == "Install Python dependencies")
    environment = nox_repo / (f"ingestion/.nox/{profile}" if profile in ("types", "style") else "env")
    monkeypatch.setenv("PYTHON_PROFILE", profile)
    lock = (nox_repo / "ingestion/uv.lock").read_bytes()

    assert_success(run("bash", "-eo", "pipefail", "-c", install, cwd=nox_repo))

    application = run(
        str(environment / "bin/python"),
        "-I",
        "-c",
        "from metadata.sample import classify; assert classify(1) == 'positive'",
        cwd=nox_repo,
    )
    assert (application.returncode == 0) == (profile != "style"), application.stdout + application.stderr
    probe = run(str(environment / "bin/python"), "-I", "-c", "import pytest, coverage", cwd=nox_repo)
    assert (probe.returncode == 0) == (profile == "test"), probe.stdout + probe.stderr
    assert (nox_repo / "ingestion/uv.lock").read_bytes() == lock


@pytest.mark.parametrize("package", ["metadata", "airflow_provider_openmetadata"])
def test_static_checks_isolate_dependencies_and_catch_application_errors(nox_repo: Path, package: str) -> None:
    assert_success(run("make", "install_test", cwd=nox_repo))
    application = nox_repo / "env/bin/python"
    snapshot = (
        "import importlib.metadata as m; print(sorted((d.metadata['Name'], d.version) for d in m.distributions()))"
    )
    before = run(str(application), "-I", "-c", snapshot, cwd=nox_repo)
    assert_success(before)
    project = nox_repo / "ingestion"
    helper = project / "src/_openmetadata_testutils/example.py"
    helper.parent.mkdir()
    helper.write_text("def helper() -> str:\n    return 1\n")
    baseline = project / ".basedpyright/baseline.json"
    original_baseline = baseline.read_bytes()

    assert_success(run("make", "static-checks", cwd=nox_repo))

    after = run(str(application), "-I", "-c", snapshot, cwd=nox_repo)
    assert_success(after)
    assert after.stdout == before.stdout
    checker = project / ".nox/types/bin/python"
    assert_success(
        run(
            str(checker),
            "-I",
            "-c",
            "import importlib.util as u; import basedpyright; "
            "assert all(u.find_spec(n) is None for n in ['pytest', 'coverage', 'xdist'])",
            cwd=nox_repo,
        )
    )
    source = project / f"src/{package}/example.py"
    source.parent.mkdir(exist_ok=True)
    source.write_text("def application() -> str:\n    return 1\n")

    result = run("make", "static-checks", cwd=nox_repo)

    assert result.returncode != 0
    assert "reportReturnType" in result.stdout + result.stderr
    assert str(source) in result.stdout + result.stderr
    assert baseline.read_bytes() == original_baseline


@pytest.mark.parametrize("profile", ["test", "test-classification"])
def test_python_preparation_restores_test_dependencies_after_dev_install(nox_repo: Path, monkeypatch, profile) -> None:
    assert_success(run("make", "install_dev", cwd=nox_repo))
    action = yaml.safe_load((REPO_ROOT / ".github/actions/prepare-python-environment/action.yml").read_text())
    restore = next(step["run"] for step in action["runs"]["steps"] if "PYTHON_PROFILE" in step.get("env", {}))
    monkeypatch.setenv("PYTHON_PROFILE", profile)

    assert_success(run("bash", "-eo", "pipefail", "-c", restore, cwd=nox_repo))

    assert_success(
        run(
            str(nox_repo / "env/bin/python"),
            "-I",
            "-c",
            "import pytest, coverage; from metadata.sample import classify",
            cwd=nox_repo,
        )
    )


@pytest.mark.parametrize("suite", ["unit", "integration"])
@pytest.mark.parametrize("exit_code", [0, 1, 5])
def test_ci_suite_records_pytest_status_and_streams_real_output(nox_repo, monkeypatch, suite, exit_code):
    test = nox_repo / f"ingestion/tests/{suite}/test_selection.py"
    test.write_text(
        f"def test_selected():\n    print('suite output')\n    assert {exit_code != 1}\n"
        if exit_code != 5
        else "value = 1\n"
    )
    assert_success(run("make", "install_test", cwd=nox_repo))
    monkeypatch.setenv("SUITE", suite)
    monkeypatch.setenv("NOX_ARGS", f"-n 0 -s tests/{suite}/test_selection.py")
    action = yaml.safe_load((REPO_ROOT / ".github/actions/python-suite/action.yml").read_text())

    result = run("bash", "-eo", "pipefail", "-c", action["runs"]["steps"][0]["run"], cwd=nox_repo)

    assert (result.returncode == 0) == (exit_code == 0), result.stdout + result.stderr
    assert (nox_repo / f"ingestion/{suite}-test-exit-code.txt").read_text().strip() == str(exit_code)
    assert (nox_repo / f"ingestion/junit/test-results-{suite}.xml").is_file()
    log = (nox_repo / f"ingestion/{suite}-test-run.log").read_text()
    expected = {0: "1 passed", 1: "1 failed", 5: "no tests ran"}[exit_code]
    assert expected in log
    assert expected in result.stdout
    if exit_code != 5:
        assert "suite output" in log
        assert "suite output" in result.stdout


@pytest.mark.parametrize("exit_code", [0, 1, 5])
@pytest.mark.parametrize("collect", [True, False])
@pytest.mark.parametrize("suite", ["legacy", "v2"])
def test_cli_e2e_preserves_pytest_outcome_and_subprocess_coverage(
    nox_repo: Path, exit_code: int, collect: bool, suite: str
) -> None:
    tests = nox_repo / ("ingestion/tests/cli_e2e_v2/demo" if suite == "v2" else "ingestion/tests/cli_e2e")
    tests.mkdir(parents=True)
    if suite == "v2":
        (tests / "conftest.py").write_text(
            "def pytest_addoption(parser):\n"
            "    parser.addoption('--e2e-contract-check', action='store_true')\n"
            "def pytest_configure(config):\n"
            "    assert config.getoption('--e2e-contract-check')\n"
        )
    (tests / "test_cli_demo.py").write_text(
        "import subprocess, sys\nfrom metadata.sample import classify\n"
        "def test_connector():\n"
        "    assert classify(1) == 'positive'\n"
        "    subprocess.run([sys.executable, '-c', "
        "\"from metadata.sample import classify; assert classify(-1) == 'other'\"], check=True)\n"
        f"    assert {exit_code != 1}\n"
        if exit_code != 5
        else "value = 1\n"
    )
    args = [] if collect else ["--no-cov"]
    if suite == "v2":
        args.extend(["--suite", "v2"])
    result = run("nox", "--no-venv", "-s", "cli-e2e", "--", "demo", *args, cwd=nox_repo / "ingestion")
    assert (result.returncode == 0) == (exit_code == 0), result.stdout + result.stderr
    assert (nox_repo / "ingestion/cli-e2e-test-exit-code.txt").read_text().strip() == str(exit_code)
    report = "v2-demo" if suite == "v2" else "demo"
    assert (nox_repo / f"ingestion/junit/test-results-{report}.xml").is_file()
    if not collect:
        assert not list((nox_repo / "ingestion").glob(".coverage*"))
    elif exit_code != 5:
        from coverage import CoverageData

        coverage = CoverageData(str(nox_repo / "ingestion/.coverage.demo"))
        coverage.read()
        assert coverage.lines("src/metadata/sample.py") == [1, 2, 3, 4]
    if exit_code != 5:
        assert reported_test_names(nox_repo, report) == ["test_connector"]


@pytest.mark.parametrize("connector, workers", [("bigquery", "6"), ("snowflake", "4")])
def test_cli_v2_runs_contracts_with_connector_worker_counts(nox_repo, connector, workers):
    from coverage import CoverageData

    tests = nox_repo / "ingestion/tests/cli_e2e_v2" / connector
    tests.mkdir(parents=True)
    (tests / "conftest.py").write_text(
        "def pytest_addoption(parser):\n"
        "    parser.addoption('--e2e-contract-check', action='store_true')\n"
        "def pytest_configure(config):\n"
        "    assert config.getoption('--e2e-contract-check')\n"
    )
    (tests / "test_workers.py").write_text(
        "import os, subprocess, sys\nfrom metadata.sample import classify\n"
        f"def test_workers():\n    assert os.environ['PYTEST_XDIST_WORKER_COUNT'] == {workers!r}\n"
        "    assert classify(1) == 'positive'\n"
        "    subprocess.run([sys.executable, '-c', "
        "\"from metadata.sample import classify; assert classify(-1) == 'other'\"], check=True)\n"
    )
    result = run(
        "nox",
        "--no-venv",
        "-s",
        "cli-e2e",
        "--",
        connector,
        "--suite",
        "v2",
        cwd=nox_repo / "ingestion",
    )
    assert_success(result)
    assert reported_test_names(nox_repo, f"v2-{connector}") == ["test_workers"]
    data = CoverageData(str(nox_repo / f"ingestion/.coverage.{connector}"))
    data.read()
    assert data.lines("src/metadata/sample.py") == [1, 2, 3, 4]
    assert (2, 3) in data.arcs("src/metadata/sample.py")
    assert (2, 4) in data.arcs("src/metadata/sample.py")


@pytest.mark.parametrize(
    "entrypoint, workers", [("make", None), ("nox", "2"), ("nox", "0"), ("nox", "auto"), ("make", "2")]
)
def test_unit_commands_default_to_four_and_respect_overrides(
    nox_repo: Path, entrypoint: str, workers: str | None
) -> None:
    expected = {None: "4", "2": "2", "0": None, "auto": "1"}[workers]
    (nox_repo / "ingestion/tests/unit/test_selection.py").write_text(
        "import os\n\ndef test_worker_count():\n"
        f"    assert os.environ.get('PYTEST_XDIST_WORKER_COUNT') == {expected!r}\n"
    )
    args = [] if workers is None else ["-n", workers]
    if entrypoint == "make":
        result = run("make", "unit_ingestion", "ARGS=" + " ".join(args), cwd=nox_repo)
    else:
        result = nox_tests(nox_repo, "unit", *args)

    assert_success(result)
    assert reported_test_names(nox_repo, "unit") == ["test_worker_count"]


@pytest.mark.parametrize(
    "directory, target",
    [(".", "unit_ingestion"), ("ingestion", "unit_ingestion"), (".", "unit_ingestion_dev_env")],
)
def test_make_unit_commands_use_the_complete_selection(nox_repo: Path, directory: str, target: str) -> None:
    for relative, name in (
        ("workflow/test_workflow_selection.py", "test_workflow_selected"),
        ("test_airflow_selection.py", "test_airflow_selected"),
        ("profiler/sqlalchemy/azuresql/test_azuresql_sampling.py", "test_azuresql_selected"),
    ):
        test = nox_repo / "ingestion/tests/unit" / relative
        test.parent.mkdir(parents=True, exist_ok=True)
        test.write_text(f"def {name}():\n    pass\n")

    report = nox_repo / "ingestion/junit/test-results-unit.xml"
    assert_success(run("make", target, f"ARGS=-n 0 --junitxml={report}", cwd=nox_repo / directory))

    assert sorted(reported_test_names(nox_repo, "unit")) == [
        "test_airflow_selected",
        "test_azuresql_selected",
        "test_unit_rejected",
        "test_unit_selected",
        "test_workflow_selected",
    ]


@pytest.mark.parametrize("entrypoint, selection", [("nox", "node"), ("make", "keyword"), ("nox", "marker")])
def test_unit_commands_run_only_the_requested_subset(nox_repo: Path, entrypoint: str, selection: str) -> None:
    (nox_repo / "ingestion/tests/unit/test_selection.py").write_text(
        "import pytest\n\n@pytest.mark.slow\ndef test_unit_selected():\n    pass\n\n"
        "def test_unit_rejected():\n    assert False, 'Unrequested test executed'\n"
    )
    if entrypoint == "make":
        result = run("make", "unit_ingestion", "ARGS=-n 0 -k 'unit_selected and not rejected'", cwd=nox_repo)
    else:
        args = {
            "node": ["tests/unit/test_selection.py::test_unit_selected"],
            "marker": ["-m", "slow"],
        }[selection]
        result = nox_tests(nox_repo, "unit", "-n", "0", *args)

    assert_success(result)
    assert reported_test_names(nox_repo, "unit") == ["test_unit_selected"]


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


@pytest.mark.parametrize("suite, path_first", [("unit", True), ("integration", False)])
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


def test_make_coverage_combines_unit_and_integration(tooling_repo: Path, monkeypatch) -> None:
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

    assert_success(run("make", "coverage", cwd=tooling_repo))

    report = ET.parse(tooling_repo / "ingestion/ci-coverage.xml").getroot()
    sample = report.find(".//class[@name='sample.py']")
    assert sample is not None
    assert sample.attrib["line-rate"] == "1"
    assert sample.attrib["branch-rate"] == "1"
    assert (tooling_repo / "ingestion/.coverage").is_file()
    assert not (tooling_repo / ".coverage").exists()


@pytest.mark.parametrize("target", ["run_python_tests", "coverage"])
def test_make_coverage_rejects_missing_data(tooling_repo: Path, target: str) -> None:
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

    result = run("make", "MAKE=true", target, cwd=tooling_repo)

    assert result.returncode != 0, result.stdout + result.stderr
    assert "No data to report" in result.stdout + result.stderr


@pytest.fixture
def manifest_repo(tmp_path: Path) -> Path:
    for relative in (
        "Makefile",
        "ingestion/Makefile",
        "ingestion/noxfile.py",
        "ingestion/pyproject.toml",
        "ingestion/uv.lock",
        "scripts/datamodel_generation.py",
        "scripts/generate_ingestion_models.py",
        "scripts/python_tools.py",
        "openmetadata-spec/scripts/prepare_model_schemas.py",
        "ingestion/src/metadata/generated/__init__.py",
    ):
        path = tmp_path / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("original\n")
    shutil.copyfile(REPO_ROOT / "scripts/check_generated_models.py", tmp_path / "scripts/check_generated_models.py")
    assert_success(run(sys.executable, "scripts/check_generated_models.py", "--write", cwd=tmp_path))
    return tmp_path


@pytest.mark.parametrize(
    "changed",
    [
        "scripts/generate_ingestion_models.py",
        "scripts/python_tools.py",
        "openmetadata-spec/scripts/prepare_model_schemas.py",
        "ingestion/uv.lock",
        "ingestion/pyproject.toml",
        "ingestion/noxfile.py",
        "ingestion/Makefile",
        "ingestion/src/metadata/generated/__init__.py",
    ],
)
def test_generation_manifest_detects_changes(manifest_repo: Path, changed: str) -> None:
    command = (sys.executable, "scripts/check_generated_models.py", "--check")
    assert_success(run(*command, cwd=manifest_repo))
    path = manifest_repo / changed
    path.write_text(path.read_text() + "\n# Changed generation contract.\n")

    result = run(*command, cwd=manifest_repo)

    assert result.returncode == 1, result.stdout + result.stderr
    assert changed in result.stdout
    assert_success(run(sys.executable, "scripts/check_generated_models.py", "--write", cwd=manifest_repo))
    assert_success(run(*command, cwd=manifest_repo))


@pytest.mark.parametrize("directory", [".", "ingestion"])
def test_locked_install_bootstraps_existing_env_and_prunes_extraneous(nox_repo: Path, directory: str) -> None:
    environment = nox_repo / "env"
    assert not environment.exists()
    assert_success(run(sys.executable, "-m", "venv", str(environment), cwd=nox_repo))
    assert_success(run("make", "install_test", cwd=nox_repo / directory))
    python = str(environment / "bin/python")
    assert_success(
        run(python, "-c", "from metadata.sample import classify; assert classify(1) == 'positive'", cwd=nox_repo)
    )
    assert not (nox_repo / "ingestion/.venv").exists()

    extra = nox_repo / "unused-package"
    extra.mkdir()
    (extra / "setup.py").write_text(
        "from setuptools import setup\nsetup(name='om-unused-fixture',version='0.0.0',py_modules=['unused_fixture'])\n"
    )
    (extra / "unused_fixture.py").write_text("VALUE = 1\n")
    assert_success(run("uv", "pip", "install", "--python", python, str(extra), cwd=nox_repo))
    assert_success(run(python, "-c", "import unused_fixture", cwd=nox_repo))

    assert_success(run("make", "install_test", cwd=nox_repo / directory))

    assert_success(
        run(
            python,
            "-c",
            "from importlib.metadata import packages_distributions; import pytest, packaging, idna; assert idna.__version__ == '3.11'; "
            "assert 'unused_fixture' not in packages_distributions()",
            cwd=nox_repo,
        )
    )


def test_ingestion_default_make_installs_application(nox_repo: Path) -> None:
    assert_success(run("make", cwd=nox_repo / "ingestion"))
    assert_success(
        run(
            str(nox_repo / "env/bin/python"),
            "-I",
            "-c",
            "import idna; from importlib.metadata import version; assert version('python-tooling-fixture') == '0.0.0'",
            cwd=nox_repo,
        )
    )
    assert not (nox_repo / "ingestion/.venv").exists()


@pytest.mark.parametrize("directory", [".", "ingestion"])
def test_direct_nox_session_installs_locked_profile(nox_repo: Path, directory: str) -> None:
    prefix_file = nox_repo / "unit-python-prefix"
    (nox_repo / "ingestion/tests/unit/test_selection.py").write_text(
        "import sys\nfrom pathlib import Path\n\ndef test_unit_selected():\n"
        f"    Path({str(prefix_file)!r}).write_text(sys.prefix)\n"
        "\ndef test_unit_rejected():\n    assert False\n"
    )
    noxfile = "ingestion/noxfile.py" if directory == "." else "noxfile.py"
    result = run(
        "nox", "-f", noxfile, "-s", "unit-tests", "--", "-k", "selected and not rejected", cwd=nox_repo / directory
    )
    assert_success(result)
    assert reported_test_names(nox_repo, "unit") == ["test_unit_selected"]
    environment = Path(prefix_file.read_text())
    assert environment.parent == nox_repo / "ingestion/.nox"
    assert (environment / "pyvenv.cfg").is_file()
    assert not (nox_repo / ".nox").exists()
    assert_success(
        run(
            str(environment / "bin/python"),
            "-I",
            "-c",
            "import pytest, coverage; import importlib.util; assert importlib.util.find_spec('uv') is None",
            cwd=nox_repo,
        )
    )


def test_nox_rejects_stale_lock_before_executing(nox_repo: Path) -> None:
    sentinel = nox_repo / "unexpected-execution"
    (nox_repo / "ingestion/tests/unit/test_sentinel.py").write_text(
        f"from pathlib import Path\ndef test_sentinel():\n    Path({str(sentinel)!r}).touch()\n"
    )
    config = nox_repo / "ingestion/pyproject.toml"
    config.write_text(config.read_text().replace("test = [", 'test = ["idna==3.11", '))
    lock = nox_repo / "ingestion/uv.lock"
    before = lock.read_bytes()
    result = nox_tests(nox_repo, "unit", "tests/unit/test_sentinel.py", "-n", "0")
    assert result.returncode != 0, result.stdout + result.stderr
    assert not sentinel.exists()
    assert lock.read_bytes() == before


def test_nox_refuses_a_non_venv_directory(tooling_repo: Path) -> None:
    project = tooling_repo / "ingestion"
    original = (project / "pyproject.toml").read_bytes()
    result = run(
        "nox",
        "-f",
        "ingestion/noxfile.py",
        "-s",
        "install",
        "--",
        "style",
        "--environment",
        str(project),
        cwd=tooling_repo,
    )
    assert result.returncode != 0, result.stdout + result.stderr
    assert not (project / "pyvenv.cfg").exists()
    assert (project / "pyproject.toml").read_bytes() == original


@pytest.mark.parametrize("directory", [".", "ingestion"])
def test_relative_environment_uses_invocation_directory(tooling_repo: Path, directory: str) -> None:
    environment = tooling_repo / "custom-tools"
    result = run(
        "nox",
        "-f",
        str(tooling_repo / "ingestion/noxfile.py"),
        "-s",
        "install",
        "--",
        "style",
        "--environment",
        os.path.relpath(environment, tooling_repo / directory),
        cwd=tooling_repo / directory,
    )
    assert_success(result)
    assert (environment / "pyvenv.cfg").is_file()
    assert_success(run(str(environment / "bin/python"), "-I", "-c", "import ruff", cwd=tooling_repo))
    assert not (tooling_repo / "ingestion/custom-tools").exists()


@pytest.mark.parametrize("directory", [".", "ingestion"])
def test_relative_application_environment(nox_repo: Path, directory: str, monkeypatch) -> None:
    environment = nox_repo / "custom-application"
    monkeypatch.setenv("OM_PYTHON_ENVIRONMENT", os.path.relpath(environment, nox_repo / directory))
    assert_success(run("make", "install_test", cwd=nox_repo / directory))
    assert_success(
        run(str(environment / "bin/python"), "-I", "-c", "from metadata.sample import classify", cwd=nox_repo)
    )
    assert not (nox_repo / "env").exists()
    assert not (nox_repo / "ingestion/custom-application").exists()


@pytest.mark.parametrize("wrong_uv", [False, True])
def test_local_bootstrap_installs_and_reuses_pinned_uv(nox_repo: Path, monkeypatch, wrong_uv: bool) -> None:
    monkeypatch.delenv("GITHUB_ACTIONS", raising=False)
    monkeypatch.delenv("CI", raising=False)
    binaries = nox_repo / "bin"
    binaries.mkdir()
    wrong = binaries / "uv"
    if wrong_uv:
        wrong.write_text(f'#!{sys.executable}\nprint("uv 0.0.0")\n')
        wrong.chmod(0o755)
    monkeypatch.setenv("PATH", str(binaries) + ":/usr/bin:/bin:/usr/sbin:/sbin")
    assert bool(shutil.which("uv")) == wrong_uv
    assert shutil.which("nox") is None
    assert_success(run("make", "install_test", f"PYTHON={sys.executable}", cwd=nox_repo))
    result = run(str(nox_repo / "ingestion/.nox/bootstrap/bin/uv"), "--version", cwd=nox_repo)
    assert_success(result)
    assert result.stdout.split()[:2] == ["uv", UV_VERSION]
    managed = nox_repo / "ingestion/.nox/bootstrap/bin/uv"
    installed = managed.stat().st_mtime_ns
    assert_success(run("make", "install_test", f"PYTHON={sys.executable}", cwd=nox_repo))
    assert managed.stat().st_mtime_ns == installed
    if wrong_uv:
        assert_success(run(str(wrong), "--version", cwd=nox_repo))
        assert run(str(wrong), "--version", cwd=nox_repo).stdout.strip() == "uv 0.0.0"
    assert_success(
        run(
            str(nox_repo / "env/bin/python"),
            "-c",
            "import pytest; from metadata.sample import classify; assert classify(1) == 'positive'",
            cwd=nox_repo,
        )
    )


@pytest.mark.parametrize("wrong_uv", [False, True])
def test_ci_bootstrap_rejects_missing_or_wrong_uv_without_installing(
    tooling_repo: Path, monkeypatch, wrong_uv: bool
) -> None:
    binaries = tooling_repo / "bin"
    binaries.mkdir()
    if wrong_uv:
        executable = binaries / "uv"
        executable.write_text(f'#!{sys.executable}\nprint("uv 0.0.0")\n')
        executable.chmod(0o755)
    make = shutil.which("make")
    assert make
    monkeypatch.setenv("PATH", str(binaries))
    monkeypatch.setenv("GITHUB_ACTIONS", "true")

    result = run(make, "python_tools", f"PYTHON={sys.executable}", cwd=tooling_repo)

    assert result.returncode != 0, result.stdout + result.stderr
    assert f"Expected uv {UV_VERSION}" in result.stderr
    assert not (tooling_repo / "ingestion/.nox/bootstrap").exists()


def test_ci_profiles_reuse_external_uv_without_installing_environment_copies(nox_repo: Path, monkeypatch) -> None:
    uv = Path(shutil.which("uv")).resolve()
    installed = uv.stat().st_mtime_ns
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    monkeypatch.setenv("OM_UV_EXECUTABLE", str(uv))
    assert_success(run("make", "install_test", cwd=nox_repo))
    nox = nox_repo / "ingestion/.nox/bootstrap/bin/nox"
    for profile in ("style", "coverage"):
        assert_success(run(str(nox), "-f", "ingestion/noxfile.py", "-s", "install", "--", profile, cwd=nox_repo))
    for path in [
        nox_repo / "env",
        *[nox_repo / "ingestion/.nox" / name for name in ("bootstrap", "generation", "style", "coverage")],
    ]:
        assert not (path / "bin/uv").exists()
        assert_success(
            run(
                str(path / "bin/python"),
                "-I",
                "-c",
                "from importlib.metadata import distributions; assert not any(d.metadata['Name'].lower() == 'uv' for d in distributions())",
                cwd=nox_repo,
            )
        )
    assert uv.stat().st_mtime_ns == installed


def test_explicit_uv_version_is_checked_before_nox_bootstrap(tooling_repo: Path, monkeypatch) -> None:
    executable = tooling_repo / "wrong-uv"
    executable.write_text(f'#!{sys.executable}\nprint("uv 0.0.0")\n')
    executable.chmod(0o755)
    monkeypatch.setenv("OM_UV_EXECUTABLE", str(executable))

    result = run("make", "python_tools", cwd=tooling_repo)

    assert result.returncode != 0, result.stdout + result.stderr
    assert f"OM_UV_EXECUTABLE must point to uv {UV_VERSION}" in result.stderr
    assert not (tooling_repo / "ingestion/.nox/bootstrap").exists()


def test_changed_uv_pin_rejects_the_previous_executable(tooling_repo: Path, monkeypatch) -> None:
    config = tooling_repo / "ingestion/pyproject.toml"
    config.write_text(
        config.read_text().replace(f'required-version = "=={UV_VERSION}"', 'required-version = "==0.0.0"')
    )
    monkeypatch.setenv("OM_UV_EXECUTABLE", shutil.which("uv"))
    monkeypatch.setenv("GITHUB_ACTIONS", "true")

    result = run("make", "python_tools", cwd=tooling_repo)

    assert result.returncode != 0, result.stdout + result.stderr
    assert "must point to uv 0.0.0" in result.stderr
    assert not (tooling_repo / "ingestion/.nox/bootstrap").exists()


def test_application_environment_uv_is_not_selected_for_exact_sync(nox_repo: Path, monkeypatch) -> None:
    environment = nox_repo / "env"
    assert_success(run(sys.executable, "-m", "venv", str(environment), cwd=nox_repo))
    sentinel = nox_repo / "application-uv-used"
    executable = environment / "bin/uv"
    executable.write_text(
        f"#!{sys.executable}\nfrom pathlib import Path\nPath({str(sentinel)!r}).touch()\nprint('uv {UV_VERSION}')\n"
    )
    executable.chmod(0o755)
    monkeypatch.setenv("PATH", str(environment / "bin") + os.pathsep + os.environ["PATH"])

    assert_success(run("make", "install_test", cwd=nox_repo))

    assert not sentinel.exists()


def test_tool_profile_does_not_prune_application_dependencies(nox_repo: Path, monkeypatch) -> None:
    assert_success(run("make", "install_test", cwd=nox_repo))
    monkeypatch.setenv("OM_PYTHON_ENVIRONMENT", str(nox_repo / "env"))
    assert_success(
        run(
            "nox",
            "-f",
            "ingestion/noxfile.py",
            "-s",
            "install",
            "--",
            "style",
            cwd=nox_repo,
        )
    )
    assert_success(
        run(
            str(nox_repo / "env/bin/python"),
            "-c",
            "import pytest, coverage; from metadata.sample import classify; assert classify(0) == 'other'",
            cwd=nox_repo,
        )
    )
    assert (nox_repo / "ingestion/.nox/style/bin/python").exists()


def test_tool_install_ignores_metadata_on_callers_pythonpath(nox_repo: Path) -> None:
    expected = importlib.metadata.version("ruff")
    metadata = nox_repo / f"ingestion/src/ruff-{expected}.dist-info"
    metadata.mkdir()
    (metadata / "METADATA").write_text(f"Metadata-Version: 2.1\nName: ruff\nVersion: {expected}\n")

    result = run(
        "nox",
        "-f",
        "ingestion/noxfile.py",
        "-s",
        "install",
        "--",
        "style",
        cwd=nox_repo,
    )

    assert_success(result)
    environment = nox_repo / "ingestion/.nox/style"
    installed = run(str(environment / "bin/ruff"), "--version", cwd=nox_repo)
    assert_success(installed)
    assert installed.stdout.strip() == f"ruff {expected}"
    assert_success(
        run(
            str(environment / "bin/python"),
            "-I",
            "-c",
            f"from importlib.metadata import version; assert version('ruff') == {expected!r}",
            cwd=nox_repo,
        )
    )


@pytest.mark.parametrize("profile, directory", [("style", "."), ("coverage", "ingestion"), ("generation", ".")])
def test_explicit_tool_environment_preserves_application(nox_repo: Path, profile: str, directory: str) -> None:
    assert_success(run("make", "install_test", cwd=nox_repo))
    environment = nox_repo / "env"
    assert_success(
        run(
            "nox",
            "-f",
            str(nox_repo / "ingestion/noxfile.py"),
            "-s",
            "install",
            "--",
            profile,
            "--environment",
            os.path.relpath(environment, nox_repo / directory),
            cwd=nox_repo / directory,
        )
    )
    assert_success(
        run(
            str(environment / "bin/python"),
            "-I",
            "-c",
            "import pytest, coverage; from metadata.sample import classify; assert classify(1) == 'positive'",
            cwd=nox_repo / directory,
        )
    )


@pytest.mark.parametrize("exit_code", [0, 3])
def test_reindex_session_keeps_token_out_of_logs(nox_repo: Path, exit_code: int) -> None:
    script = nox_repo / "scripts/ingest_100k_containers.py"
    script.write_text(
        "import json, sys, idna\nfrom pathlib import Path\n"
        "assert idna.__version__ == '3.11'\n"
        "Path('reindex-result.json').write_text(json.dumps({'args':sys.argv[1:], 'environment':sys.prefix}))\n"
        f"sys.exit({exit_code})\n"
    )
    token = "fixture-token"
    result = run("nox", "-f", "ingestion/noxfile.py", "-s", "reindex-perf-ingest", "--", "--token", token, cwd=nox_repo)
    assert result.returncode == (1 if exit_code else 0), result.stdout + result.stderr
    assert token not in result.stdout + result.stderr
    observed = json.loads((nox_repo / "ingestion/reindex-result.json").read_text())
    assert observed == {"args": ["--token", token], "environment": str(nox_repo / "env")}


def test_repeated_install_preserves_lock_and_package_selection(nox_repo: Path) -> None:
    lock = nox_repo / "ingestion/uv.lock"
    before = lock.read_bytes()
    assert_success(run("make", "install_test", cwd=nox_repo))
    command = (
        str(nox_repo / "env/bin/python"),
        "-I",
        "-c",
        "import importlib.metadata as m, json; "
        "print(json.dumps(sorted((d.metadata['Name'],d.version) for d in m.distributions())))",
    )
    first = run(*command, cwd=nox_repo)
    assert_success(first)
    assert_success(run("make", "install_test", cwd=nox_repo))
    second = run(*command, cwd=nox_repo)
    assert_success(second)
    assert first.stdout == second.stdout
    assert lock.read_bytes() == before


@pytest.mark.parametrize("directory", [".", "ingestion"])
def test_nested_nox_reuses_explicit_application_environment(nox_repo: Path, directory: str) -> None:
    environment = nox_repo / "custom-env"
    (nox_repo / "ingestion/tests/unit/test_selection.py").write_text(
        "import sys\nfrom pathlib import Path\n\ndef test_unit_selected():\n"
        f"    assert Path(sys.prefix).resolve() == Path({str(environment)!r}).resolve()\n"
    )
    assert_success(
        run("make", "unit_ingestion", f"OM_VENV_DIR={environment}", "ARGS=-n 0 -k selected", cwd=nox_repo / directory)
    )
    assert reported_test_names(nox_repo, "unit") == ["test_unit_selected"]
    assert (environment / "pyvenv.cfg").is_file()
    assert not (nox_repo / "env").exists()
    assert not (nox_repo / "ingestion/.venv").exists()


def test_generation_session_uses_prepared_python(tooling_repo: Path) -> None:
    (tooling_repo / "scripts/generate_ingestion_models.py").write_text(
        "import sys\nfrom pathlib import Path\nPath('generation-python').write_text(sys.prefix)\n"
    )
    assert_success(run("nox", "-f", "ingestion/noxfile.py", "-s", "generate", cwd=tooling_repo))
    assert (tooling_repo / "ingestion/generation-python").read_text() == str(tooling_repo / "ingestion/.nox/generation")


@pytest.fixture
def generation_repo(tooling_repo: Path, monkeypatch) -> Path:
    makefile = tooling_repo / "Makefile"
    makefile.write_text("ANTLR_VERSION := 4.9.2\n" + makefile.read_text())
    tools = tooling_repo / "tools"
    tools.mkdir()
    antlr = tools / "antlr4"
    antlr.write_text(
        f"#!{sys.executable}\n"
        "import os, sys\nfrom pathlib import Path\n"
        "version = os.environ.get('TEST_ANTLR_VERSION', '4.9.2')\n"
        "if len(sys.argv) == 1:\n"
        "    print('ANTLR Parser Generator Version ' + version)\n"
        "else:\n"
        "    output = Path(sys.argv[sys.argv.index('-o') + 1])\n"
        "    output.mkdir(parents=True, exist_ok=True)\n"
        "    (output / 'parser.py').write_text('VERSION = ' + repr(version) + '\\n')\n"
    )
    antlr.chmod(0o755)
    monkeypatch.setenv("PATH", str(tools) + os.pathsep + os.environ["PATH"])
    (tooling_repo / "scripts/datamodel_generation.py").write_text(
        "import os\nfrom pathlib import Path\n"
        "output = Path('ingestion/src/metadata/generated')\n"
        "(output / '__init__.py').touch()\n"
        "(output / 'model.py').write_text('VALUE = 1\\n')\n"
        "if os.environ.get('TEST_GENERATION_PHASE') == 'generation':\n"
        "    with open(os.environ['TEST_GENERATION_READY'], 'w') as ready: ready.write('ready\\n')\n"
        "    with open(os.environ['TEST_GENERATION_RELEASE']) as release: release.readline()\n"
    )
    return tooling_repo


@pytest.mark.parametrize("version", ["4.13.2", "4.9.20"])
def test_generation_rejects_wrong_antlr_without_deleting_outputs(generation_repo: Path, monkeypatch, version: str):
    monkeypatch.setenv("TEST_ANTLR_VERSION", version)
    generated = generation_repo / "ingestion/src/metadata/generated"
    before = {p.relative_to(generated): p.read_bytes() for p in generated.rglob("*") if p.is_file()}

    result = run("nox", "-f", "ingestion/noxfile.py", "-s", "generate", "--", "--python-only", cwd=generation_repo)

    assert result.returncode != 0, result.stdout + result.stderr
    assert "4.9.2" in result.stdout + result.stderr
    assert {p.relative_to(generated): p.read_bytes() for p in generated.rglob("*") if p.is_file()} == before


@pytest.mark.parametrize("phase", ["generation", "installation"])
def test_generation_and_installation_exclude_other_writers(generation_repo: Path, monkeypatch, phase: str):
    ready = generation_repo / "ready"
    release = generation_repo / "release"
    os.mkfifo(ready)
    os.mkfifo(release)
    ready_fd = os.open(ready, os.O_RDWR | os.O_NONBLOCK)
    release_fd = os.open(release, os.O_RDWR | os.O_NONBLOCK)
    monkeypatch.setenv("TEST_GENERATION_PHASE", phase)
    monkeypatch.setenv("TEST_GENERATION_READY", str(ready))
    monkeypatch.setenv("TEST_GENERATION_RELEASE", str(release))
    if phase == "installation":
        (generation_repo / "ingestion/setup.py").write_text(
            "import os\nfrom pathlib import Path\nfrom setuptools import setup\n"
            "once = Path(os.environ['TEST_GENERATION_READY'] + '.once')\n"
            "if not once.exists():\n"
            "    once.touch()\n"
            "    with open(os.environ['TEST_GENERATION_READY'], 'w') as ready: ready.write('ready\\n')\n"
            "    with open(os.environ['TEST_GENERATION_RELEASE']) as release: release.readline()\n"
            "setup()\n"
        )
    args = ["generate", "--", "--python-only"] if phase == "generation" else ["install", "--", "runtime"]
    log = generation_repo / "generation.log"
    with log.open("w") as output:
        process = subprocess.Popen(
            ["nox", "-f", "ingestion/noxfile.py", "-s", *args],
            cwd=generation_repo,
            stdout=output,
            stderr=subprocess.STDOUT,
        )
        try:
            assert select.select([ready_fd], [], [], 60)[0], log.read_text()
            assert b"ready" in os.read(ready_fd, 100)
            with (
                (generation_repo / "ingestion/.nox/generation.lock").open("a") as lock,
                pytest.raises(BlockingIOError),
            ):
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        finally:
            os.write(release_fd, b"continue\n")
            try:
                process.wait(timeout=90)
            finally:
                if process.poll() is None:
                    process.kill()
                    process.wait()
                os.close(ready_fd)
                os.close(release_fd)
    assert process.returncode == 0, log.read_text()


@pytest.fixture
def model_origin(tmp_path):
    requests = []
    state = {"status": 200, "transient": 0}

    class Handler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def end_headers(self):
            self.send_header("Cache-Control", "max-age=0")
            super().end_headers()

        def do_GET(self):
            requests.append(self.path)
            if state["transient"]:
                state["transient"] -= 1
                self.send_error(503)
            elif state["status"] != 200:
                self.send_error(state["status"])
            else:
                super().do_GET()

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=str(tmp_path)))
    thread = threading.Thread(target=server.serve_forever)
    thread.start()
    requirements = []
    for name in ("fixture_first", "fixture_second"):
        wheel = tmp_path / f"{name}-1.0.0-py3-none-any.whl"
        with zipfile.ZipFile(wheel, "w") as stream:
            stream.writestr(f"{name}/__init__.py", "VALUE = 42\n")
            stream.writestr(
                f"{name}-1.0.0.dist-info/METADATA",
                f"Metadata-Version: 2.3\nName: {name}\nVersion: 1.0.0\nRequires-Python: >=3.10\n",
            )
            stream.writestr(
                f"{name}-1.0.0.dist-info/WHEEL",
                "Wheel-Version: 1.0\nRoot-Is-Purelib: true\nTag: py3-none-any\n",
            )
            stream.writestr(f"{name}-1.0.0.dist-info/RECORD", "")
        digest = hashlib.sha256(wheel.read_bytes()).hexdigest()
        requirements.append(
            f"{name.replace('_', '-')} @ http://127.0.0.1:{server.server_port}/{wheel.name}#sha256={digest}"
        )
    try:
        yield requirements, state, requests
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def model_helper(*args, cwd):
    return run(sys.executable, str(REPO_ROOT / "scripts/prepare_classification_models.py"), *args, cwd=cwd)


def add_fixture_models(repo, requirements):
    config = repo / "ingestion/pyproject.toml"
    text = (
        config.read_text()
        .replace("[dependency-groups]", "[dependency-groups]\nclassification-models = " + json.dumps(requirements))
        .replace(
            '[tool.openmetadata.python-environments.profiles.test-classification]\ngroups = ["test"]',
            '[tool.openmetadata.python-environments.profiles.test-classification]\ngroups = ["test", "classification-models"]',
        )
    )
    for name in ("fixture-first", "fixture-second"):
        text += f'\n[[tool.uv.dependency-metadata]]\nname = "{name}"\nversion = "1.0.0"\nrequires-dist = []\nrequires-python = ">=3.10"\n'
    config.write_text(text)
    assert_success(run("uv", "lock", "--project", "ingestion", cwd=repo))
    assert_success(run(sys.executable, str(repo / "scripts/check_generated_models.py"), "--write", cwd=repo))


def test_model_archives_merge_and_repeated_locked_sync_avoids_denied_origin(nox_repo, model_origin, monkeypatch):
    requirements, state, requests = model_origin
    add_fixture_models(nox_repo, requirements)
    archives = []
    for index, requirement in enumerate(requirements):
        archive = nox_repo / f"model-{index}.tar"
        assert_success(
            model_helper(
                "prepare",
                "--requirement",
                requirement,
                "--uv-version",
                UV_VERSION,
                "--output",
                str(archive),
                cwd=nox_repo,
            )
        )
        archives.append(archive)
    cache = nox_repo / "cache"
    monkeypatch.setenv("UV_CACHE_DIR", str(cache))
    state["status"] = 503
    requests.clear()
    lock = (nox_repo / "ingestion/uv.lock").read_bytes()
    # The general test profile must neither install weights nor run the public provisioning CLI.
    (nox_repo / "ingestion/src/metadata/__main__.py").write_text("raise AssertionError('unexpected provisioning')\n")
    assert_success(run("nox", "--no-venv", "-s", "install", "--", "test", cwd=nox_repo / "ingestion"))
    python = str(nox_repo / "env/bin/python")
    assert_success(
        run(
            python,
            "-c",
            "import importlib.util; assert importlib.util.find_spec('fixture_first') is None",
            cwd=nox_repo,
        )
    )
    for archive in archives * 2:
        assert_success(model_helper("import", "--archive", str(archive), "--cache-dir", str(cache), cwd=nox_repo))
    for _ in range(2):
        assert_success(run("make", "install_test", cwd=nox_repo))
        assert_success(
            run(
                python,
                "-c",
                "import fixture_first, fixture_second, idna; assert fixture_first.VALUE + fixture_second.VALUE == 84",
                cwd=nox_repo,
            )
        )
    assert (nox_repo / "ingestion/uv.lock").read_bytes() == lock
    assert requests == []
    # Stale requirements still fail with locked validation, even when models cannot be fetched.
    config = nox_repo / "ingestion/pyproject.toml"
    config.write_text(config.read_text().replace("idna==3.11", "idna==3.10"))
    result = run("make", "install_test", cwd=nox_repo)
    assert result.returncode != 0
    assert "lockfile" in result.stderr.lower()
    assert (nox_repo / "ingestion/uv.lock").read_bytes() == lock
    assert requests == []


@pytest.mark.parametrize("failure", ["transient", "permanent", "hash"])
def test_model_preparation_retries_only_transient_failures(tmp_path, model_origin, failure):
    requirements, state, requests = model_origin
    requirement = requirements[0]
    if failure == "transient":
        state["transient"] = 1
    elif failure == "permanent":
        state["status"] = 404
    else:
        requirement = requirement.split("#")[0] + "#sha256=" + "0" * 64
    output = tmp_path / "model.tar"
    result = model_helper(
        "prepare", "--requirement", requirement, "--uv-version", UV_VERSION, "--output", str(output), cwd=tmp_path
    )
    if failure == "transient":
        assert_success(result)
        assert output.is_file()
        assert 2 <= len(requests) <= 3
    else:
        assert result.returncode != 0
        assert not output.exists()
        assert len(requests) == (2 if failure == "hash" else 1)
        if failure == "hash":
            assert "Hash mismatch" in result.stderr


def test_model_discovery_rejects_metadata_version_mismatch_and_tracks_identity(tmp_path):
    project = tmp_path / "ingestion"
    project.mkdir()
    config = project / "pyproject.toml"
    digest = "a" * 64
    original = f"""[tool.uv]
required-version = "=={UV_VERSION}"
[[tool.uv.dependency-metadata]]
name = "fixture-model"
version = "1.2.3"
requires-dist = []
[dependency-groups]
classification-models = ["fixture-model @ https://example.invalid/fixture_model-1.2.3-py3-none-any.whl#sha256={digest}"]
[tool.openmetadata.python-environments]
supported-python = ["3.9", "3.13", "3.10"]
"""
    config.write_text(original)
    result = model_helper("discover", "--project", str(project), cwd=tmp_path)
    assert_success(result)
    baseline = json.loads(result.stdout)
    assert baseline["discovery-python"] == "3.13"
    [model] = baseline["include"]
    assert model["name"] == "fixture-model"
    for old, new in [
        ("#sha256=", "?mirror=second#sha256="),
        ("#sha256=", "?#sha256="),
        (digest, "b" * 64),
        (f"=={UV_VERSION}", "==0.0.0"),
    ]:
        config.write_text(original.replace(old, new))
        result = model_helper("discover", "--project", str(project), cwd=tmp_path)
        assert_success(result)
        [changed] = json.loads(result.stdout)["include"]
        assert changed["key"] != model["key"]
    config.write_text(original.replace('version = "1.2.3"', 'version = "1.2.4"'))
    result = model_helper("discover", "--project", str(project), cwd=tmp_path)
    assert result.returncode != 0
    assert "Missing exact static dependency metadata" in result.stderr


def test_model_free_test_profile_preserves_test_dependencies_after_model_selection(nox_repo, model_origin, monkeypatch):
    requirements, state, requests = model_origin
    add_fixture_models(nox_repo, requirements)
    cache = nox_repo / "cache"
    monkeypatch.setenv("UV_CACHE_DIR", str(cache))
    for index, requirement in enumerate(requirements):
        archive = nox_repo / f"model-{index}.tar"
        assert_success(
            model_helper(
                "prepare",
                "--requirement",
                requirement,
                "--uv-version",
                UV_VERSION,
                "--output",
                str(archive),
                cwd=nox_repo,
            )
        )
        assert_success(model_helper("import", "--archive", str(archive), "--cache-dir", str(cache), cwd=nox_repo))
    state["status"] = 403
    requests.clear()
    for profile, present in [("test", False), ("test-classification", True), ("test", False)]:
        assert_success(run("make", "install_test", f"PYTHON_TEST_PROFILE={profile}", cwd=nox_repo))
        result = run(
            str(nox_repo / "env/bin/python"),
            "-I",
            "-c",
            "import importlib.util, pytest; "
            f"assert (importlib.util.find_spec('fixture_first') is not None) is {present}; "
            f"assert (importlib.util.find_spec('fixture_second') is not None) is {present}",
            cwd=nox_repo,
        )
        assert_success(result)
    assert requests == []


def test_model_versions_coexist_in_one_cache_after_parallel_preparation(tmp_path, model_origin, monkeypatch):
    requirements, state, requests = model_origin
    first = requirements[0]
    second_wheel = tmp_path / "fixture_first-2.0.0-py3-none-any.whl"
    with (
        zipfile.ZipFile(tmp_path / "fixture_first-1.0.0-py3-none-any.whl") as original,
        zipfile.ZipFile(second_wheel, "w") as updated,
    ):
        for name in original.namelist():
            content = (
                original.read(name).replace(b"Version: 1.0.0", b"Version: 2.0.0").replace(b"VALUE = 42", b"VALUE = 43")
            )
            updated.writestr(name.replace("1.0.0", "2.0.0"), content)
    second = (
        first.split("#")[0].replace("1.0.0", "2.0.0")
        + "#sha256="
        + hashlib.sha256(second_wheel.read_bytes()).hexdigest()
    )
    archives = [tmp_path / "old.tar", tmp_path / "new.tar"]

    def seed(pair):
        requirement, archive = pair
        assert_success(
            model_helper(
                "prepare",
                "--requirement",
                requirement,
                "--uv-version",
                UV_VERSION,
                "--output",
                str(archive),
                cwd=tmp_path,
            )
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(seed, zip([first, second], archives, strict=True)))
    cache = tmp_path / "cache"
    monkeypatch.setenv("UV_CACHE_DIR", str(cache))
    monkeypatch.delenv("UV_PROJECT_ENVIRONMENT", raising=False)
    for archive in archives:
        assert_success(model_helper("import", "--archive", str(archive), "--cache-dir", str(cache), cwd=tmp_path))
    state["status"] = 503
    requests.clear()
    for version, requirement, value in [("1.0.0", first, 42), ("2.0.0", second, 43)]:
        project = tmp_path / version
        project.mkdir()
        (project / "pyproject.toml").write_text(
            '[project]\nname="fixture-project"\nversion="0.0.0"\nrequires-python=">=3.10"\n'
            "[dependency-groups]\nclassification-models=[" + json.dumps(requirement) + "]\n"
            f'[tool.uv]\npackage=false\nrequired-version="=={UV_VERSION}"\ndefault-groups=[]\n'
            '[[tool.uv.dependency-metadata]]\nname="fixture-first"\nversion="'
            + version
            + '"\nrequires-dist=[]\nrequires-python=">=3.10"\n'
        )
        assert_success(run("uv", "lock", "--python", sys.executable, cwd=project))
        lock = (project / "uv.lock").read_bytes()
        assert_success(
            run(
                "uv",
                "sync",
                "--locked",
                "--only-group",
                "classification-models",
                "--python",
                sys.executable,
                cwd=project,
            )
        )
        assert_success(
            run(
                str(project / ".venv/bin/python"),
                "-c",
                f"import fixture_first; assert fixture_first.VALUE == {value}",
                cwd=project,
            )
        )
        assert (project / "uv.lock").read_bytes() == lock
    assert requests == []
