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

from ingestion.tests.utils.python_tooling import prepare_locked_tooling

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


@pytest.mark.parametrize("entrypoint", ["make", "nox"])
@pytest.mark.parametrize("workers", [None, "2", "0", "auto"], ids=["default", "two", "serial", "auto"])
def test_unit_worker_count_defaults_to_four_and_respects_overrides(
    nox_repo: Path, entrypoint: str, workers: str | None
) -> None:
    expected = {None: "4", "2": "2", "0": None, "auto": "1"}[workers]
    (nox_repo / "ingestion/tests/unit/test_selection.py").write_text(
        "import os\n\ndef test_worker_count():\n"
        f"    assert os.environ.get('PYTEST_XDIST_WORKER_COUNT') == {expected!r}\n"
    )
    args = ["-n", workers] if workers is not None else []
    if entrypoint == "make":
        result = run("make", "unit_ingestion", "ARGS=" + " ".join(args), cwd=nox_repo)
    else:
        result = nox_tests(nox_repo, "unit", *args)

    assert_success(result)
    assert reported_test_names(nox_repo, "unit") == ["test_worker_count"]


@pytest.mark.parametrize("directory", [".", "ingestion"])
@pytest.mark.parametrize("target", ["unit_ingestion", "unit_ingestion_dev_env"])
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


@pytest.mark.parametrize("entrypoint", ["make", "nox"])
@pytest.mark.parametrize("selection", ["node", "keyword", "marker"])
def test_unit_commands_run_only_the_requested_subset(nox_repo: Path, entrypoint: str, selection: str) -> None:
    (nox_repo / "ingestion/tests/unit/test_selection.py").write_text(
        "import pytest\n\n@pytest.mark.slow\ndef test_unit_selected():\n    pass\n\n"
        "def test_unit_rejected():\n    assert False, 'Unrequested test executed'\n"
    )
    args = {
        "node": ["tests/unit/test_selection.py::test_unit_selected"],
        "keyword": ["-k", "unit_selected and not rejected"],
        "marker": ["-m", "slow"],
    }[selection]
    if entrypoint == "make":
        selection_args = {
            "node": "tests/unit/test_selection.py::test_unit_selected",
            "keyword": "-k 'unit_selected and not rejected'",
            "marker": "-m slow",
        }[selection]
        result = run("make", "unit_ingestion", f"ARGS=-n 0 {selection_args}", cwd=nox_repo)
    else:
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


@pytest.mark.parametrize(
    "changed",
    [
        "scripts/generate_ingestion_models.py",
        "openmetadata-spec/scripts/prepare_model_schemas.py",
        "ingestion/uv.lock",
        "ingestion/pyproject.toml",
        "ingestion/noxfile.py",
        "ingestion/Makefile",
        "ingestion/src/metadata/generated/__init__.py",
    ],
)
def test_generation_manifest_detects_changes(tooling_repo: Path, changed: str) -> None:
    command = (sys.executable, "scripts/check_generated_models.py", "--check")
    assert_success(run(*command, cwd=tooling_repo))
    path = tooling_repo / changed
    path.write_text(path.read_text() + "\n# Changed generation contract.\n")

    result = run(*command, cwd=tooling_repo)

    assert result.returncode == 1, result.stdout + result.stderr
    assert changed in result.stdout
    assert_success(run(sys.executable, "scripts/check_generated_models.py", "--write", cwd=tooling_repo))
    assert_success(run(*command, cwd=tooling_repo))


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
    assert_success(run(str(environment / "bin/python"), "-I", "-c", "import pytest, coverage, uv", cwd=nox_repo))


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


def test_empty_environment_bootstraps_pinned_uv_without_uv_on_path(nox_repo: Path, monkeypatch) -> None:
    monkeypatch.setenv("PATH", "/usr/bin:/bin:/usr/sbin:/sbin")
    assert shutil.which("uv") is None
    assert shutil.which("nox") is None
    assert_success(run("make", "install_test", f"PYTHON={sys.executable}", cwd=nox_repo))
    result = run(str(nox_repo / "ingestion/.nox/bootstrap/bin/uv"), "--version", cwd=nox_repo)
    assert_success(result)
    assert result.stdout.startswith("uv 0.13.4 ")
    assert_success(
        run(
            str(nox_repo / "env/bin/python"),
            "-c",
            "import pytest; from metadata.sample import classify; assert classify(1) == 'positive'",
            cwd=nox_repo,
        )
    )


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


@pytest.mark.parametrize("directory", [".", "ingestion"])
@pytest.mark.parametrize("profile", ["style", "coverage", "generation"])
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
                "0.13.4",
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
    assert_success(model_helper("clean", "--project", str(nox_repo / "ingestion"), cwd=nox_repo))
    assert_success(run("uv", "cache", "prune", "--ci", "--force", cwd=nox_repo))
    assert not any(p.name in ("fixture_first", "fixture_second") for p in cache.rglob("*"))
    assert (cache / "CACHEDIR.TAG").is_file()
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
        "prepare", "--requirement", requirement, "--uv-version", "0.13.4", "--output", str(output), cwd=tmp_path
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


@pytest.mark.skipif(sys.version_info < (3, 11), reason="CI bootstrap uses stdlib tomllib")
@pytest.mark.parametrize(
    ("versions", "maximum"),
    [(["3.10", "3.11", "3.12"], "3.12"), (["3.9", "3.10"], "3.10")],
)
def test_python_matrix_bootstraps_from_pyproject_without_site_packages(tmp_path, versions, maximum):
    project = tmp_path / "ingestion"
    project.mkdir()
    (project / "pyproject.toml").write_text(
        "[tool.openmetadata.python-environments]\nsupported-python = " + json.dumps(versions) + "\n"
    )

    result = run(
        sys.executable,
        "-I",
        "-S",
        str(REPO_ROOT / "scripts/prepare_classification_models.py"),
        "matrix",
        "--project",
        str(project),
        cwd=tmp_path,
    )

    assert_success(result)
    assert json.loads(result.stdout) == {"python-versions": versions, "discovery-python": maximum}


def test_model_discovery_rejects_metadata_version_mismatch_and_tracks_identity(tmp_path):
    project = tmp_path / "ingestion"
    project.mkdir()
    config = project / "pyproject.toml"
    original = (REPO_ROOT / "ingestion/pyproject.toml").read_text()
    config.write_text(original)
    result = model_helper("discover", "--project", str(project), cwd=tmp_path)
    assert_success(result)
    baseline = json.loads(result.stdout)
    assert baseline["discovery-python"] == "3.12"
    keys = {entry["name"]: entry["key"] for entry in baseline["include"]}
    for old, new in [
        ("#sha256=5e63", "?mirror=second#sha256=5e63"),
        ("#sha256=5e63", "?#sha256=5e63"),
        ("#sha256=5e63", "#sha256=6e63"),
        ("==0.13.4", "==0.13.5"),
    ]:
        config.write_text(original.replace(old, new))
        result = model_helper("discover", "--project", str(project), cwd=tmp_path)
        assert_success(result)
        changed = {entry["name"]: entry["key"] for entry in json.loads(result.stdout)["include"]}
        assert changed["en-core-web-md"] != keys["en-core-web-md"]
    config.write_text(original.replace('version = "3.8.0"', 'version = "3.9.0"', 1))
    result = model_helper("discover", "--project", str(project), cwd=tmp_path)
    assert result.returncode != 0
    assert "Missing exact static dependency metadata" in result.stderr


def test_model_warmer_resolves_exact_revisions_and_deduplicates_retained_versions(tmp_path, monkeypatch):
    script = REPO_ROOT / ".github/scripts/classification_model_revisions.py"
    monkeypatch.setenv("SUPPORTED_HEADS", "[]")
    monkeypatch.setenv("RETAINED_REVISIONS", json.dumps(["a" * 40, "b" * 40, "a" * 40]))
    monkeypatch.delenv("REQUESTED_REVISION", raising=False)
    result = run(sys.executable, str(script), cwd=tmp_path)
    assert_success(result)
    assert json.loads(result.stdout.split("=", 1)[1]) == ["a" * 40, "b" * 40]
    monkeypatch.setenv("REQUESTED_REVISION", "c" * 40)
    result = run(sys.executable, str(script), cwd=tmp_path)
    assert_success(result)
    assert json.loads(result.stdout.split("=", 1)[1]) == ["c" * 40]
    monkeypatch.setenv("REQUESTED_REVISION", "main")
    result = run(sys.executable, str(script), cwd=tmp_path)
    assert result.returncode != 0
    assert "Expected exact commit SHAs" in result.stderr


def fixture_model_metadata(requirements):
    return (
        "[dependency-groups]\nclassification-models="
        + json.dumps(requirements)
        + '\n[tool.uv]\nrequired-version="==0.13.4"\n'
        + "\n".join(
            '[[tool.uv.dependency-metadata]]\nname="' + name + '"\nversion="1.0.0"\nrequires-dist=[]\n'
            for name in ["fixture-first", "fixture-second"]
        )
        + '\n[tool.openmetadata.python-environments]\nsupported-python=["3.10","3.12"]\n'
    )


def sequential_models(tmp_path, records, write, uv_version, save_failure=False):
    adapter = tmp_path / "cache_adapter.py"
    adapter.write_text(
        """import json, pathlib, shutil, sys
failure, operation, key, result_file = sys.argv[1:]
archive = pathlib.Path("model-cache/model.tar")
stored = pathlib.Path("stored") / key
if operation == "restore":
    result = None
    if stored.exists():
        archive.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(stored, archive)
        result = key
elif failure == "true":
    result = -1
else:
    stored.parent.mkdir(exist_ok=True)
    shutil.copyfile(archive, stored)
    result = 1
pathlib.Path(result_file).write_text(json.dumps(result))
"""
    )
    args = [
        "batch",
        "--models",
        json.dumps(records),
        "--archives",
        str(tmp_path / "artifacts"),
        "--uv-version",
        uv_version,
        "--cache-command",
        sys.executable,
        str(adapter),
        str(save_failure).lower(),
    ]
    if write:
        args.append("--save-cache")
    return model_helper(*args, cwd=tmp_path)


@pytest.mark.parametrize("write,uv_version", [(True, "0.13.4"), (False, "0.13.4"), (True, "0.13.3")])
def test_sequential_model_archives_preserve_payloads_and_only_warmer_saves(tmp_path, model_origin, write, uv_version):
    requirements, state, requests = model_origin
    project = tmp_path / "project"
    project.mkdir()
    (project / "pyproject.toml").write_text(fixture_model_metadata(requirements))
    result = model_helper("discover", "--project", str(project), cwd=tmp_path)
    assert_success(result)
    records = json.loads(result.stdout)["include"]
    assert_success(sequential_models(tmp_path, records, write, uv_version))
    archives = {p.parent.name: p.read_bytes() for p in (tmp_path / "artifacts").glob("*/model.tar")}
    stored = {p.name: p.read_bytes() for p in (tmp_path / "stored").glob("*")}
    assert len(archives) == (0 if write else 2)
    assert len(stored) == (2 if write else 0)
    state["status"] = 403
    requests.clear()
    result = sequential_models(tmp_path, records, False, uv_version)
    if write:
        assert_success(result)
        assert {p.parent.name: p.read_bytes() for p in (tmp_path / "artifacts").glob("*/model.tar")} == stored
        assert {p.name: p.read_bytes() for p in (tmp_path / "stored").glob("*")} == stored
        assert requests == []
    else:
        assert result.returncode != 0
        assert requests


def test_sequential_model_hash_failure_publishes_no_archives(tmp_path, model_origin):
    requirements, _state, requests = model_origin
    project = tmp_path / "project"
    project.mkdir()
    bad = requirements[0].split("#")[0] + "#sha256=" + "0" * 64
    (project / "pyproject.toml").write_text(fixture_model_metadata([bad]))
    result = model_helper("discover", "--project", str(project), cwd=tmp_path)
    assert_success(result)
    result = sequential_models(tmp_path, json.loads(result.stdout)["include"], True, "0.13.4")
    assert result.returncode != 0
    assert "Hash mismatch" in result.stderr
    assert requests
    assert not list((tmp_path / "artifacts").glob("*/model.tar"))
    assert not list((tmp_path / "stored").glob("*"))


def test_sequential_model_save_failure_fails_warmer(tmp_path, model_origin):
    requirements, _state, _requests = model_origin
    project = tmp_path / "project"
    project.mkdir()
    (project / "pyproject.toml").write_text(fixture_model_metadata(requirements))
    result = model_helper("discover", "--project", str(project), cwd=tmp_path)
    assert_success(result)
    result = sequential_models(tmp_path, json.loads(result.stdout)["include"], True, "0.13.4", save_failure=True)
    assert result.returncode != 0
    assert "Cache save failed" in result.stderr
    assert not list((tmp_path / "stored").glob("*"))


@pytest.mark.parametrize("missing", ["ACTIONS_CACHE_URL", "ACTIONS_RUNTIME_TOKEN"])
def test_native_cache_adapter_rejects_missing_runtime_before_preparation(tmp_path, monkeypatch, missing):
    monkeypatch.setenv("ACTIONS_CACHE_URL", "http://127.0.0.1:1/")
    monkeypatch.setenv("ACTIONS_RUNTIME_TOKEN", "fixture")
    monkeypatch.delenv("ACTIONS_RESULTS_URL", raising=False)
    monkeypatch.delenv(missing)
    adapter = REPO_ROOT / ".github/actions/prepare-classification-models/cache/index.js"
    result = run("node", str(adapter), cwd=tmp_path)
    assert result.returncode != 0
    assert "Actions cache runtime unavailable" in result.stderr
    assert not (tmp_path / "model-cache").exists()


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
                "0.13.4",
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


@pytest.mark.parametrize("unsupported", [False, True])
def test_model_warmer_discovers_distinct_revision_metadata_with_current_helper(
    tmp_path, model_origin, monkeypatch, unsupported
):
    requirements, _state, _requests = model_origin
    source = tmp_path / "source"
    source.mkdir()
    assert_success(run("git", "init", "--initial-branch=main", cwd=source))
    assert_success(run("git", "config", "user.name", "Fixture", cwd=source))
    assert_success(run("git", "config", "user.email", "user@example.com", cwd=source))
    project = source / "ingestion"
    project.mkdir()
    helper = source / "scripts/prepare_classification_models.py"
    helper.parent.mkdir()
    helper.write_text('raise RuntimeError("revision helper must not run")\n')
    selected = []
    for index, records in enumerate([requirements, [requirements[0].replace("#", "?revision=next#"), requirements[1]]]):
        metadata = '[project]\nname="fixture"\n' if unsupported and index else fixture_model_metadata(records)
        (project / "pyproject.toml").write_text(metadata)
        assert_success(run("git", "add", ".", cwd=source))
        assert_success(run("git", "commit", "-m", "Fixture metadata", cwd=source))
        selected.append(run("git", "rev-parse", "HEAD", cwd=source).stdout.strip())
    checkout = tmp_path / "checkout"
    assert_success(run("git", "clone", "--depth=1", source.as_uri(), str(checkout), cwd=tmp_path))
    shutil.copyfile(
        REPO_ROOT / "scripts/prepare_classification_models.py", checkout / "scripts/prepare_classification_models.py"
    )
    monkeypatch.setenv("SUPPORTED_HEADS", "[]")
    monkeypatch.setenv("RETAINED_REVISIONS", json.dumps([*selected, selected[0]]))
    monkeypatch.delenv("REQUESTED_REVISION", raising=False)
    script = REPO_ROOT / ".github/scripts/classification_model_revisions.py"
    result = run(sys.executable, str(script), "--discover-models", cwd=checkout)
    if unsupported:
        assert result.returncode != 0
        assert "lacks the classification-models layout" in result.stderr
        return
    assert_success(result)
    records = json.loads(result.stdout.split("=", 1)[1])
    assert len(records) == 3
    assert sorted(r["name"] for r in records) == ["fixture-first", "fixture-first", "fixture-second"]
    assert len({r["key"] for r in records}) == 3
    assert any("?revision=next" in r["url"] for r in records)
    assert (checkout / "scripts/prepare_classification_models.py").read_bytes() == (
        REPO_ROOT / "scripts/prepare_classification_models.py"
    ).read_bytes()


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
                "0.13.4",
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
            '[tool.uv]\npackage=false\nrequired-version="==0.13.4"\ndefault-groups=[]\n'
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
