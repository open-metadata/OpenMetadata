#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Nox sessions for testing and formatting checks.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import nox
from nox.virtualenv import PassthroughEnv

# NOTE: This is still a work in progress! We still need to:
#    - Fix ignored unit tests
#    - Add integration tests
#    - Address the TODOs in the code

# TODO: Add python 3.9. PYTHON 3.9 fails in Mac os due to problem with `psycopg2-binary` package

SUPPORTED_PYTHON_VERSIONS = ["3.10", "3.11", "3.12"]


def get_python_versions():
    # Check if we are in GitHub Actions (i.e., if the 'PYTHON_VERSIONS' environment variable is set)
    if "PYTHON_VERSIONS" in os.environ:
        # Return the list of Python versions passed from GitHub Actions matrix
        python_versions = os.environ["PYTHON_VERSIONS"].split(",")
        # if some versions are not supported, they will be ignored by nox
        return python_versions  # noqa: RET504
    return SUPPORTED_PYTHON_VERSIONS


INGESTION_ROOT = Path(__file__).resolve().parent
nox.options.envdir = str(INGESTION_ROOT / ".nox")
ROOT = INGESTION_ROOT.parent
PROFILES = ("runtime", "all", "dev", "test", "style", "generation", "coverage")


def default_environment(profile):
    """Select the checkout application environment or an isolated tool environment."""
    if profile in ("runtime", "all", "dev", "test"):
        return Path(os.environ.get("OM_PYTHON_ENVIRONMENT") or ROOT / (os.environ.get("OM_VENV_DIR") or "env"))
    return INGESTION_ROOT / ".nox" / profile


def pinned_uv(session, python, environment):
    """Locate or install the project's exact uv version in the selected environment."""
    pins = re.findall(
        r'^required-version\s*=\s*"==([^"]+)"\s*$',
        (INGESTION_ROOT / "pyproject.toml").read_text(),
        re.MULTILINE,
    )
    if len(pins) != 1:
        session.error("Expected one exact tool.uv.required-version pin")
    for candidate in (python.parent / "uv", Path(sys.executable).parent / "uv", shutil.which("uv")):
        if candidate and Path(candidate).is_file():
            version = session.run(str(candidate), "--version", silent=True, external=True)
            if version.split()[1] == pins[0]:
                return str(candidate)
    session.run(str(python), "-I", "-m", "ensurepip", "--upgrade", env=environment, external=True)
    session.run(str(python), "-I", "-m", "pip", "install", f"uv=={pins[0]}", env=environment, external=True)
    return str(python.parent / "uv")


def synchronize(session, profile, path, interpreter):
    """Synchronize and validate a locked application or tool selection."""
    python = path / "bin/python"
    if path.exists() and any(path.iterdir()) and not (path / "pyvenv.cfg").is_file():
        session.error(f"Refusing to synchronize a non-venv path: {path}")
    if not python.exists():
        session.run(str(interpreter), "-m", "venv", str(path), external=True)
    environment = {
        "VIRTUAL_ENV": str(path),
        "UV_PROJECT_ENVIRONMENT": str(path),
        "PATH": str(path / "bin") + os.pathsep + os.environ["PATH"],
    }
    uv = pinned_uv(session, python, environment)
    command = [uv, "sync", "--locked", "--project", str(INGESTION_ROOT), "--python", str(python)]
    parser_check = "import packaging\ntry:\n import tomllib\nexcept ImportError:\n import tomli"
    if subprocess.run([str(python), "-I", "-c", parser_check], capture_output=True, check=False).returncode:
        session.run(*command, "--only-group", "environment-check", "--inexact", env=environment, external=True)
    policy = json.loads(
        session.run(
            str(python),
            "-I",
            "-c",
            "import json,sys\ntry:\n import tomllib\nexcept ImportError:\n import tomli as tomllib\n"
            "with open(sys.argv[1], 'rb') as stream:\n"
            " print(json.dumps(tomllib.load(stream)['tool']['openmetadata']['python-environments']))",
            str(INGESTION_ROOT / "pyproject.toml"),
            env=environment,
            silent=True,
            external=True,
        )
    )
    selected = policy["profiles"][profile]
    if selected["install-project"]:
        generation_python, generation_environment = synchronize(
            session, "generation", default_environment("generation"), python
        )
        check = subprocess.run(
            [str(generation_python), str(ROOT / "scripts/check_generated_models.py"), "--check"],
            cwd=ROOT,
            check=False,
        )
        if check.returncode == 1:
            session.run(
                str(generation_python),
                str(ROOT / "scripts/generate_ingestion_models.py"),
                "--python-only",
                env=generation_environment,
                external=True,
            )
        else:
            check.check_returncode()
        environment["OM_PYTHON_ENVIRONMENT"] = str(path)
    flags = [] if selected["install-project"] else ["--inexact"]
    for group in selected["groups"]:
        flags.extend(["--group" if selected["install-project"] else "--only-group", group])
    for extra in selected["extras"]:
        flags.extend(["--extra", extra])
    session.run(*command, *flags, env=environment, external=True)
    if profile == "test" and policy.get("classification-models"):
        session.run(
            str(python),
            "-I",
            "-m",
            "metadata",
            "install-classification-models",
            "--languages",
            ",".join(policy["classification-models"]["languages"]),
            env=environment,
            external=True,
        )
    checker = [str(python), "-I", str(INGESTION_ROOT / "scripts/check_python_environment.py"), "--profile", profile]
    if profile == "test" and policy.get("classification-models"):
        checker.append("--check-models")
    session.run(*checker, env=environment, external=True)
    return python, environment


def prepare(session, profile, environment=None, interpreter=None):
    """Prepare a session's locked dependencies and select its executables."""
    path = environment or (
        default_environment(profile)
        if isinstance(session.virtualenv, PassthroughEnv)
        else Path(session.virtualenv.location)
    )
    path = Path(path).expanduser()
    if not path.is_absolute():
        path = Path(session.invoked_from) / path
    path = path.resolve()
    session.chdir(INGESTION_ROOT)
    python, variables = synchronize(session, profile, path, interpreter or sys.executable)
    session.env.update(variables)
    return python


@nox.session(name="install", python=False, default=False)
def install(session):
    """Prepare a named locked selection without running an application command."""
    parser = argparse.ArgumentParser()
    parser.add_argument("profile", choices=PROFILES)
    parser.add_argument("--environment", type=Path)
    parser.add_argument("--python")
    args = parser.parse_args(session.posargs)
    prepare(session, args.profile, args.environment, args.python)


@nox.session(name="generate", python=False, default=False)
def generate(session):
    """Generate models with the locked generation tools."""
    prepare(session, "generation")
    session.run("python", str(ROOT / "scripts/generate_ingestion_models.py"), *session.posargs, external=True)


@nox.session(name="coverage", python=False, default=False)
def coverage(session):
    """Erase or report coverage using the locked reporting tools."""
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("erase", "report", "xml"))
    args = parser.parse_args(session.posargs)
    prepare(session, "coverage")
    flags = ["-o", "coverage.xml"] if args.action == "xml" else []
    session.run("coverage", args.action, "--rcfile=pyproject.toml", *flags, external=True)


@nox.session(name="precommit-install", reuse_venv=True, venv_backend="uv|venv", default=False)
def precommit_install(session):
    prepare(session, "dev")
    session.run("pre-commit", "install")


@nox.session(name="generate-settings-docs", reuse_venv=True, venv_backend="uv|venv", default=False)
def generate_settings_docs(session):
    prepare(session, "dev")
    session.run("python", str(INGESTION_ROOT / "scripts/generate_settings_docs.py"))


@nox.session(name="check-import-layers", reuse_venv=True, venv_backend="uv|venv", default=False)
def check_import_layers(session):
    prepare(session, "dev")
    session.run("lint-imports")


@nox.session(name="reindex-perf-ingest", python=False, default=False)
def reindex_perf_ingest(session):
    python = prepare(session, "dev")
    # Nox logs command arguments even on failure; this command accepts a JWT.
    result = subprocess.run(
        [str(python), str(ROOT / "scripts/ingest_100k_containers.py"), *session.posargs],
        env={name: value for name, value in {**os.environ, **session.env}.items() if value is not None},
        check=False,
    )
    if result.returncode:
        session.error("Reindex ingestion failed")


@nox.session(
    name="lint",
    reuse_venv=True,
    venv_backend="uv|venv",
)
def lint(session):
    prepare(session, "style")
    parser = argparse.ArgumentParser()
    parser.add_argument("--fix", action="store_true")
    args = parser.parse_args(session.posargs)
    sources = [str(INGESTION_ROOT), str(ROOT / "openmetadata-airflow-apis")]
    sources.extend(
        str(ROOT / "scripts" / name)
        for name in ("generate_ingestion_models.py", "check_generated_models.py", "datamodel_generation.py")
    )
    session.run(
        "ruff", "check", *(["--fix"] if args.fix else []), *sources, "--config", str(INGESTION_ROOT / "pyproject.toml")
    )
    session.run("python", "scripts/check_ruff_suppressions.py", "--prune" if args.fix else "--check")
    session.run(
        "ruff",
        "format",
        *([] if args.fix else ["--check"]),
        *sources,
        "--config",
        str(INGESTION_ROOT / "pyproject.toml"),
    )


@nox.session(name="unit-dev", reuse_venv=True, venv_backend="uv|venv", python=get_python_versions(), default=False)
def unit_dev(session):
    prepare(session, "test")
    session.run(
        "pytest",
        "-c",
        "pyproject.toml",
        "tests/unit",
        "--ignore=tests/unit/profiler/sqlalchemy/azuresql/test_azuresql_sampling.py",
        "--ignore-glob=*airflow*",
        *session.posargs,
    )


@nox.session(name="unit", reuse_venv=True, venv_backend="uv|venv", python=get_python_versions())
def unit(session):
    prepare(session, "test")
    # TODO: We need to remove ignored test once they can be run properly within nox
    # Run unit tests
    ignored_tests = [
        "test_ometa_endpoints.py",
        "test_ometa_mlmodel.py",
        "test_dbt.py",
        "test_sample_usage.py",
        "test_ssl_manager.py",
        "test_usage_filter.py",
        "test_suite/",
        "profiler/test_profiler_partitions.py",
        "profiler/test_workflow.py",
        "workflow",
        "topology",
    ]
    ignore_args = [f"--ignore=tests/unit/{test}" for test in ignored_tests]

    # run pytest with the ignore arguments and in parallel mode
    session.run("pytest", "tests/unit/", *ignore_args)


# TEST PLUGINS
PLUGINS_TESTS = {
    "great-expectations": "tests/unit/great_expectations",
}
PLUGINS = list(PLUGINS_TESTS.keys())


@nox.session(
    name="unit-plugins",
    reuse_venv=False,
    venv_backend="uv|venv",
    python=get_python_versions(),
)
@nox.parametrize("plugin", PLUGINS)
def unit_plugins(session, plugin):
    prepare(session, "test")
    # Assuming the plugin has its own tests in a specific directory
    session.run("pytest", PLUGINS_TESTS[plugin])


# ---------------------------------------------------------------------------
# Static checks
# ---------------------------------------------------------------------------
@nox.session(
    name="static-checks",
    reuse_venv=True,
    venv_backend="uv|venv",
    python=get_python_versions(),
)
def static_checks(session):
    prepare(session, "test")
    # `--baselinemode=discard` fails the run on any *new* error not in the
    # baseline (early-return path in basedpyright's BaselineHandler.write)
    # while tolerating baseline entries that don't fire on the current
    # platform (e.g. macOS arm64 vs Linux x86_64 stub drift). Critically, it
    # does not write the baseline file, unlike `auto`. The default in CI
    # would be `lock`, which exits 3 on any down-shift in error count and
    # therefore can't accommodate platform drift between developer machines
    # and the GitHub Actions runner.
    session.run(
        "basedpyright",
        "-p",
        "pyproject.toml",
        "--baselinefile",
        ".basedpyright/baseline.json",
        "--baselinemode=discard",
    )


# ---------------------------------------------------------------------------
# Unit tests
# ---------------------------------------------------------------------------
@nox.session(
    name="unit-tests",
    reuse_venv=True,
    venv_backend="uv|venv",
    python=get_python_versions(),
)
def unit_tests(session):
    """Run Python unit tests with coverage and parallel execution.

    Pass additional pytest arguments after --:
        nox -s unit-tests -- -v           # verbose output
        nox -s unit-tests -- -k test_name # run specific test
        nox -s unit-tests -- tests/unit/topology/  # run specific directory
    """
    prepare(session, "test")

    pytest_args = [
        "-c",
        "pyproject.toml",
        "-o",
        "testpaths=tests/unit/",
        "--cov=metadata",
        "--cov-branch",
        "--cov-config=pyproject.toml",
        "--junitxml=junit/test-results-unit.xml",
        "-n",
        "auto",
        "--dist",
        "loadfile",
        "--timeout=300",
        "--timeout-method=signal",
        "--durations=20",
    ]

    pytest_args.extend(session.posargs)

    session.run("pytest", *pytest_args)


# ---------------------------------------------------------------------------
# Integration tests
# ---------------------------------------------------------------------------
@nox.session(
    name="integration-tests",
    reuse_venv=True,
    venv_backend="uv|venv",
    python=get_python_versions(),
)
def integration_tests(session):
    """Run Python integration tests with coverage.

    By default includes --cov-append for local use (run after unit tests).
    Pass --standalone to produce standalone coverage for CI split jobs.

    Examples:
        nox -s integration-tests                   # local, appends to .coverage
        nox -s integration-tests -- --standalone   # CI, standalone .coverage
    """
    prepare(session, "test")

    args = list(session.posargs)
    standalone = "--standalone" in args
    if standalone:
        args.remove("--standalone")

    workers = os.environ.get("PYTEST_INTEGRATION_WORKERS", "0")
    if "--workers" in args:
        idx = args.index("--workers")
        workers = args[idx + 1]
        args = args[:idx] + args[idx + 2 :]

    pytest_args = [
        "-c",
        "pyproject.toml",
        "-o",
        "testpaths=tests/integration/",
        "--cov=metadata",
        "--cov-branch",
        "--cov-config=pyproject.toml",
        "--junitxml=junit/test-results-integration.xml",
    ]

    if not standalone:
        pytest_args.append("--cov-append")
    use_xdist = int(workers) > 0
    if use_xdist:
        pytest_args.extend([f"-n{workers}", "--dist=loadgroup"])

    pytest_args.extend(args)

    session.run("pytest", *pytest_args)


# ---------------------------------------------------------------------------
# Combine coverage
# ---------------------------------------------------------------------------
@nox.session(
    name="combine-coverage",
    reuse_venv=True,
    venv_backend="uv|venv",
)
def combine_coverage(session):
    """Combine coverage from multiple test runs and generate reports.

    Used in CI to merge coverage artifacts from separate unit and
    integration jobs. Expects .coverage files under coverage-data/.

    Example:
        nox -s combine-coverage
    """
    session.chdir(Path(__file__).resolve().parent)
    prepare(session, "coverage")
    session.run("coverage", "combine")
    session.run(
        "coverage",
        "report",
        "--rcfile=pyproject.toml",
    )
    session.run(
        "coverage",
        "xml",
        "--rcfile=pyproject.toml",
        "-o",
        "coverage.xml",
    )
    session.run("mv", "coverage.xml", "ci-coverage.xml", external=True)
