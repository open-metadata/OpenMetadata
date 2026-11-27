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
import fcntl
import os
import runpy
import shutil
import subprocess
import sys
from contextlib import contextmanager, nullcontext
from pathlib import Path

import nox
from nox.virtualenv import PassthroughEnv

try:
    import tomllib
except ImportError:
    import tomli as tomllib

with (Path(__file__).resolve().parent / "pyproject.toml").open("rb") as configuration:
    PYTHON_ENVIRONMENTS = tomllib.load(configuration)["tool"]["openmetadata"]["python-environments"]

SUPPORTED_PYTHON_VERSIONS = PYTHON_ENVIRONMENTS["supported-python"]


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
PROFILES = tuple(PYTHON_ENVIRONMENTS["profiles"])
UV = runpy.run_path(str(ROOT / "scripts/python_tools.py"))["ensure_uv"]()
os.environ["OM_UV_EXECUTABLE"] = str(UV)
os.environ["PATH"] = str(UV.parent) + os.pathsep + os.environ["PATH"]


# ADR:2026-10-27-local-python-environments-use-locked-profiles
@contextmanager
def generation_lock():
    """Exclude other writers while generating or installing checkout models."""
    path = INGESTION_ROOT / ".nox/generation.lock"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        yield


def default_environment(profile):
    """Select the checkout application environment or an isolated tool environment."""
    if profile in ("runtime", "all", "dev", "test", "test-classification"):
        return Path(os.environ.get("OM_PYTHON_ENVIRONMENT") or ROOT / (os.environ.get("OM_VENV_DIR") or "env"))
    return INGESTION_ROOT / ".nox" / profile


def synchronize(session, profile, path, interpreter):
    """Synchronize and validate a locked application or tool selection."""
    python = path / "bin/python"
    if path.exists() and any(path.iterdir()) and not (path / "pyvenv.cfg").is_file():
        session.error(f"Refusing to synchronize a non-venv path: {path}")
    if not python.exists():
        session.run(str(UV), "venv", "--python", str(interpreter), str(path), external=True)
    environment = {
        "VIRTUAL_ENV": str(path),
        "UV_PROJECT_ENVIRONMENT": str(path),
        "PATH": str(path / "bin") + os.pathsep + os.environ["PATH"],
    }
    command = [str(UV), "sync", "--locked", "--project", str(INGESTION_ROOT), "--python", str(python)]
    selected = PYTHON_ENVIRONMENTS["profiles"][profile]
    with generation_lock() if selected["install-project"] else nullcontext():
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
    with generation_lock():
        python = prepare(session, "generation")
        session.run(str(python), str(ROOT / "scripts/generate_ingestion_models.py"), *session.posargs, external=True)


@nox.session(name="coverage", python=False, default=False)
def coverage(session):
    """Erase or report coverage using the locked reporting tools."""
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("erase", "report", "xml"))
    args = parser.parse_args(session.posargs)
    python = prepare(session, "coverage")
    flags = ["-o", "coverage.xml"] if args.action == "xml" else []
    session.run(str(python.parent / "coverage"), args.action, "--rcfile=pyproject.toml", *flags, external=True)


@nox.session(name="precommit-install", reuse_venv=True, venv_backend="uv|venv", default=False)
def precommit_install(session):
    python = prepare(session, "hooks")
    session.run(str(python.parent / "pre-commit"), "install")


@nox.session(name="generate-settings-docs", reuse_venv=True, venv_backend="uv|venv", default=False)
def generate_settings_docs(session):
    python = prepare(session, "runtime")
    session.run(str(python), str(INGESTION_ROOT / "scripts/generate_settings_docs.py"))


@nox.session(name="check-import-layers", reuse_venv=True, venv_backend="uv|venv", default=False)
def check_import_layers(session):
    python = prepare(session, "imports")
    session.run(str(python.parent / "lint-imports"))


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
    python = prepare(session, "style")
    parser = argparse.ArgumentParser()
    parser.add_argument("--fix", action="store_true")
    args = parser.parse_args(session.posargs)
    sources = [
        str(INGESTION_ROOT),
        str(ROOT / "openmetadata-airflow-apis"),
        str(ROOT / "openmetadata-spec/scripts/prepare_model_schemas.py"),
    ]
    sources.extend(
        str(ROOT / "scripts" / name)
        for name in (
            "generate_ingestion_models.py",
            "check_generated_models.py",
            "datamodel_generation.py",
            "update_version.py",
            "prepare_classification_models.py",
            "python_ci.py",
            "python_tools.py",
        )
    )
    sources.extend(str(ROOT / ".github/scripts" / name) for name in ("tests/test_python_ci.py",))
    session.run(
        str(python.parent / "ruff"),
        "check",
        *(["--fix"] if args.fix else []),
        *sources,
        "--config",
        str(INGESTION_ROOT / "pyproject.toml"),
    )
    session.run(str(python), "scripts/check_ruff_suppressions.py", "--prune" if args.fix else "--check")
    session.run(
        str(python.parent / "ruff"),
        "format",
        *([] if args.fix else ["--check"]),
        *sources,
        "--config",
        str(INGESTION_ROOT / "pyproject.toml"),
    )


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
    python = prepare(session, "types")
    # `--baselinemode=discard` fails the run on any *new* error not in the
    # baseline (early-return path in basedpyright's BaselineHandler.write)
    # while tolerating baseline entries that don't fire on the current
    # platform (e.g. macOS arm64 vs Linux x86_64 stub drift). Critically, it
    # does not write the baseline file, unlike `auto`. The default in CI
    # would be `lock`, which exits 3 on any down-shift in error count and
    # therefore can't accommodate platform drift between developer machines
    # and the GitHub Actions runner.
    session.run(
        str(python.parent / "basedpyright"),
        "-p",
        "pyproject.toml",
        "--baselinefile",
        ".basedpyright/baseline.json",
        "--baselinemode=discard",
    )


# ---------------------------------------------------------------------------
# Unit tests
# ---------------------------------------------------------------------------
def run_test_process(session, command, suite, environment=None):
    """Run a test process and record its unmodified exit status."""
    if environment is None:
        environment = {name: value for name, value in {**os.environ, **session.env}.items() if value is not None}
    result = subprocess.run(command, cwd=INGESTION_ROOT, env=environment, check=False)
    (INGESTION_ROOT / f"{suite}-test-exit-code.txt").write_text(f"{result.returncode}\n")
    return result.returncode


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
    python = prepare(session, "test-classification")

    pytest_args = [
        "-c",
        "pyproject.toml",
        "-o",
        "testpaths=tests/unit/",
        "--cov=metadata",
        "--cov-branch",
        "--cov-config=pyproject.toml",
        "--junitxml=junit/test-results-unit.xml",
        # ADR:2026-10-27-unit-tests-default-to-four-xdist-workers
        "-n",
        "4",
        "--dist",
        "loadfile",
        "--timeout=300",
        "--timeout-method=signal",
        "--durations=20",
    ]

    pytest_args.extend(session.posargs)

    exit_code = run_test_process(session, [str(python.parent / "pytest"), *pytest_args], "unit")
    if exit_code:
        session.error(f"Unit tests exited with code {exit_code}")


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
    python = prepare(session, "test-classification")
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

    exit_code = run_test_process(session, [str(python.parent / "pytest"), *pytest_args], "integration")
    if exit_code:
        session.error(f"Integration tests exited with code {exit_code}")


@nox.session(name="cli-e2e", python=False, default=False)
def cli_e2e(session):
    """Run one connector's CLI tests with optional parent and subprocess coverage."""
    parser = argparse.ArgumentParser()
    parser.add_argument("connector")
    parser.add_argument("--suite", choices=("legacy", "v2"), default="legacy")
    parser.add_argument("--no-cov", action="store_true")
    args = parser.parse_args(session.posargs)
    connector = args.connector
    collect_coverage = not args.no_cov
    test = INGESTION_ROOT / "tests/cli_e2e" / f"test_cli_{connector}.py"
    pytest_args = ["--durations=20"]
    report = connector
    if args.suite == "v2":
        test = INGESTION_ROOT / "tests/cli_e2e_v2" / connector
        report = f"v2-{connector}"
        pytest_args.extend(["-v", "--e2e-contract-check"])
        workers = {"bigquery": "6", "snowflake": "4", "redshift": "4"}.get(connector)
        if workers:
            pytest_args.extend(["-n", workers])
    if not connector.replace("_", "").isalnum() or not (test.is_dir() if args.suite == "v2" else test.is_file()):
        session.error(f"Unknown CLI E2E connector: {connector}")
    python = prepare(session, "test-classification")
    environment = {name: value for name, value in {**os.environ, **session.env}.items() if value is not None}
    test_environment = environment
    command = [str(python), "-m"]
    commands = []
    if collect_coverage:
        test_environment = {
            **environment,
            "COVERAGE_FILE": str(INGESTION_ROOT / f".coverage.{connector}"),
        }
        command.extend(["coverage", "run", "--rcfile=pyproject.toml", "--branch", "-m"])
        commands = ["combine"] if os.environ.get("GITHUB_ACTIONS") == "true" else ["combine", "report"]
    exit_code = run_test_process(
        session,
        [
            *command,
            "pytest",
            "-c",
            "pyproject.toml",
            *pytest_args,
            f"--junitxml=junit/test-results-{report}.xml",
            str(test),
        ],
        "cli-e2e",
        test_environment,
    )
    for command in commands:
        subprocess.run(
            [str(python), "-m", "coverage", command, f"--data-file=.coverage.{connector}", "--rcfile=pyproject.toml"],
            cwd=INGESTION_ROOT,
            env=environment,
            check=False,
        )
    if exit_code:
        session.error(f"CLI E2E tests exited with code {exit_code}")


# ---------------------------------------------------------------------------
# Combine coverage
# ---------------------------------------------------------------------------
@nox.session(name="combine-coverage", python=False)
def combine_coverage(session):
    """Combine local or downloaded coverage and stage JUnit reports."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--coverage-dir", type=Path)
    parser.add_argument("--results-dir", type=Path)
    args = parser.parse_args(session.posargs)
    python = prepare(session, "coverage")
    files = []
    if args.coverage_dir:
        directory = Path(session.invoked_from) / args.coverage_dir
        files = sorted(path for path in directory.rglob(".coverage*") if path.is_file())
        if not files:
            session.error("No Python coverage artifacts were downloaded")
    if args.results_dir:
        directory = Path(session.invoked_from) / args.results_dir
        junit = INGESTION_ROOT / "junit"
        junit.mkdir(exist_ok=True)
        for index, path in enumerate(sorted(directory.rglob("test-results*.xml"))):
            shutil.copyfile(path, junit / f"test-results-{index}.xml")
    session.run(str(python.parent / "coverage"), "combine", "--rcfile=pyproject.toml", "--keep", *map(str, files))
    session.run(
        str(python.parent / "coverage"),
        "xml",
        "--rcfile=pyproject.toml",
    )
