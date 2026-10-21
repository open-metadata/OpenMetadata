"""Run the repository Nox sessions against small, real pytest suites."""

import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]


@pytest.fixture
def nox_project(tmp_path):
    for name in ("noxfile.py", "python-versions.json"):
        shutil.copyfile(ROOT / "ingestion" / name, tmp_path / name)
    (tmp_path / "pyproject.toml").write_text('[tool.pytest.ini_options]\naddopts = ""\n')
    (tmp_path / "metadata").mkdir()
    (tmp_path / "metadata/__init__.py").write_text("VALUE = 1\n")
    for suite in ("unit", "integration"):
        directory = tmp_path / "tests" / suite
        directory.mkdir(parents=True)
        (directory / "test_choices.py").write_text(
            "from metadata import VALUE\n"
            "def test_selected():\n    assert VALUE == 1\n"
            "def test_other():\n    assert VALUE == 1\n"
        )
    (tmp_path / "test_failure.py").write_text("def test_failure():\n    assert False\n")
    return tmp_path


def run_nox(project, session, args):
    environment = {
        **os.environ,
        "PYTHONPATH": str(project),
        "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1",
        "PYTEST_ADDOPTS": "-p pytest_cov.plugin -p xdist.plugin -p pytest_timeout",
    }
    environment.pop("PYTEST_PLUGINS", None)
    return subprocess.run(
        [sys.executable, "-m", "nox", "--non-interactive", "--no-venv", "-s", session, "--", *args],
        cwd=project,
        env=environment,
        capture_output=True,
        text=True,
        timeout=90,
        check=False,
    )


@pytest.mark.parametrize(
    "args, passed, deselected",
    [
        (["-k", "selected", "--maxfail", "1", "-n0"], 1, 1),
        (["-n0"], 2, 0),
        (["tests/unit/test_choices.py::test_other", "-n0"], 1, 0),
        (["tests/unit/test_choices.py", "-k", "selected", "-n0"], 1, 1),
    ],
)
def test_unit_pytest_selection_and_valued_options(nox_project, args, passed, deselected):
    result = run_nox(nox_project, "unit-tests", args)
    output = result.stdout + result.stderr
    assert result.returncode == 0, output
    assert f"{passed} passed" in output
    if deselected:
        assert f"{deselected} deselected" in output


@pytest.mark.parametrize("session", ["unit-tests", "integration-tests"])
def test_assertion_failure_propagates_through_nox(nox_project, session):
    result = run_nox(nox_project, session, ["test_failure.py", "-n0"])
    assert result.returncode != 0
    assert "1 failed" in result.stdout + result.stderr


@pytest.mark.parametrize(
    "args, passed",
    [
        (["--standalone", "--workers", "0", "-k", "selected", "--maxfail", "1"], 1),
        (["--standalone", "--workers", "0"], 2),
        (["--standalone", "--workers", "1", "tests/integration/test_choices.py::test_other"], 1),
    ],
)
def test_integration_options_and_default_root(nox_project, args, passed):
    result = run_nox(nox_project, "integration-tests", args)
    output = result.stdout + result.stderr
    assert result.returncode == 0, output
    assert f"{passed} passed" in output
