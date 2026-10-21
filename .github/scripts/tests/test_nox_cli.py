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
    "args, passed",
    [
        (["-k", "selected", "--maxfail", "1"], 1),
        ([], 2),
        (["tests/{suite}/test_choices.py::test_other"], 1),
    ],
)
@pytest.mark.parametrize("suite", ["unit", "integration"])
def test_pytest_arguments_and_default_root(nox_project, suite, args, passed):
    options = ["-n0"] if suite == "unit" else ["--standalone", "--workers", "0"]
    result = run_nox(nox_project, f"{suite}-tests", [*options, *(arg.format(suite=suite) for arg in args)])
    output = result.stdout + result.stderr
    assert result.returncode == 0, output
    assert f"{passed} passed" in output
