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

import importlib.metadata
import json
import os
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
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
    noxfile = "ingestion/noxfile.py" if directory == "." else "noxfile.py"
    result = run(
        "nox", "-f", noxfile, "-s", "unit-tests", "--", "-k", "selected and not rejected", cwd=nox_repo / directory
    )
    assert_success(result)
    assert reported_test_names(nox_repo, "unit") == ["test_unit_selected"]
    environments = list((nox_repo / "ingestion/.nox").glob("unit-tests*/bin/python"))
    assert len(environments) == 1
    assert not (nox_repo / ".nox").exists()
    assert_success(run(str(environments[0]), "-c", "import pytest, coverage, uv", cwd=nox_repo))


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
