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

import os

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


def install(session, *args, **kwargs):
    """Install packages unless running with --no-venv (packages already installed)."""
    if not isinstance(session.virtualenv, PassthroughEnv):
        session.install(*args, **kwargs)


def install_group(session, group):
    """Install a PEP 735 dependency group unless using the active environment."""
    if not isinstance(session.virtualenv, PassthroughEnv):
        session.run("uv", "pip", "install", "--group", f"pyproject.toml:{group}", external=True)


def ensure_generated_models(session):
    """Check generated files and regenerate them when stale."""
    result = session.run(
        "python",
        "../scripts/check_generated_models.py",
        "--check",
        silent=True,
        success_codes=[0, 1],
    )
    if result:
        session.log(result.rstrip())
    if result and not result.startswith("Generated models are up to date."):
        session.run(
            "python",
            "../scripts/generate_ingestion_models.py",
            "--python-only",
            external=True,
        )


@nox.session(
    name="lint",
    reuse_venv=True,
    venv_backend="uv|venv",
)
def lint(session):
    # Single-tool replacement for the old black + isort + pycln stack.
    # Mirrors `make py_format_check` so local nox and Makefile stay in sync.
    install(session, "-e", ".")
    install_group(session, "style")
    session.run("ruff", "check", ".", "../openmetadata-airflow-apis/")
    session.run("python", "scripts/check_ruff_suppressions.py", "--check")
    session.run("ruff", "format", "--check", ".", "../openmetadata-airflow-apis/")


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
    install(session, "-e", ".")
    install_group(session, "dev")
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
    install(session, "-e", ".[all,airflow,great-expectations]")
    install_group(session, "test")
    ensure_generated_models(session)

    # Separate test paths from pytest flags in posargs
    args = list(session.posargs)
    test_paths = [a for a in args if not a.startswith("-")]
    extra_flags = [a for a in args if a.startswith("-")]

    pytest_args = [
        "-c",
        "pyproject.toml",
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

    pytest_args.extend(test_paths or ["tests/unit/"])
    pytest_args.extend(extra_flags)

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
    install(session, "-e", ".[all,airflow,great-expectations]")
    install_group(session, "test")
    ensure_generated_models(session)

    args = list(session.posargs)
    standalone = "--standalone" in args
    if standalone:
        args.remove("--standalone")

    workers = os.environ.get("PYTEST_INTEGRATION_WORKERS", "0")
    if "--workers" in args:
        idx = args.index("--workers")
        workers = args[idx + 1]
        args = args[:idx] + args[idx + 2 :]

    # Separate test paths from pytest flags in posargs
    test_paths = [a for a in args if not a.startswith("-")]
    extra_flags = [a for a in args if a.startswith("-")]

    pytest_args = [
        "-c",
        "pyproject.toml",
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

    pytest_args.extend(test_paths or ["tests/integration/"])
    pytest_args.extend(extra_flags)

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

    NOTE: The ``sed -i`` step uses GNU sed syntax and only works on Linux
    (CI runners).  On macOS, BSD sed requires a backup-extension argument
    (``sed -i ''``), so running this session locally will fail at that step.

    Example:
        nox -s combine-coverage
    """
    install(session, "coverage[toml]")
    session.run("coverage", "combine")
    session.run(
        "coverage",
        "report",
        "--rcfile=pyproject.toml",
        success_codes=[0, 1],
    )
    session.run(
        "coverage",
        "xml",
        "--rcfile=pyproject.toml",
        "-o",
        "coverage.xml",
        success_codes=[0, 1],
    )
    session.run(
        "sed",
        r's|filename="[^"]*\(/metadata/[^"]*"\)|filename="src\1|g',
        "coverage.xml",
        "-i",
        external=True,
    )
    session.run("mv", "coverage.xml", "ci-coverage.xml", external=True)
