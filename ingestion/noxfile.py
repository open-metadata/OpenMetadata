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
import ast
import os
from pathlib import Path

# NOTE: This is still a work in progress! We still need to:
#    - Fix ignored unit tests
#    - Add integration tests
#    - Address the TODOs in the code
import nox

# TODO: Add python 3.9. PYTHON 3.9 fails in Mac os due to problem with `psycopg2-binary` package

SUPPORTED_PYTHON_VERSIONS = ["3.10", "3.11"]


def get_python_versions():
    # Check if we are in GitHub Actions (i.e., if the 'PYTHON_VERSIONS' environment variable is set)
    if "PYTHON_VERSIONS" in os.environ:
        # Return the list of Python versions passed from GitHub Actions matrix
        python_versions = os.environ["PYTHON_VERSIONS"].split(",")
        # if some versions are not supported, they will be ignored by nox
        return python_versions
    return SUPPORTED_PYTHON_VERSIONS


@nox.session(
    name="lint",
    reuse_venv=False,
    venv_backend="uv|venv",
)
def lint(session):
    # Usually, we want just one Python version for linting and type check,
    # so no need to specify them here
    session.install(".[dev]")
    # Configuration from pyproject.toml is taken into account out of the box
    session.run("black", "--check", ".", "../openmetadata-airflow-apis/")
    #session.run("isort", "--check-only", ".", "../openmetadata-airflow-apis/")
    #session.run("pycln", "--diff", ".", "../openmetadata-airflow-apis/")
    # TODO: It remains to adapt the command from the Makefile:
    # 	PYTHONPATH="${PYTHONPATH}:$(INGESTION_DIR)/plugins" pylint --errors-only
    # 	--rcfile=$(INGESTION_DIR)/pyproject.toml --fail-under=10 $(PY_SOURCE)/metadata
    # 	|| (echo "PyLint error code $$?"; exit 1)
    #   Some work is required to import plugins correctly


@nox.session(
    name="unit", reuse_venv=False, venv_backend="uv|venv", python=get_python_versions()
)
def unit(session):
    session.install(".[all-dev-env, test-unit]")
    # TODO: we need to install pip so that spaCy can install its dependencies
    #       we should find a way to avoid this
    session.install("pip")

    # TODO: We need to remove ignored test once they can be run properly within nox
    # Run unit tests
    ignored_tests = [
        "test_ometa_endpoints.py",
        "test_ometa_mlmodel.py",
        "test_dbt.py",
        "test_sample_usage.py",
        "test_ssl_manager.py",
        "test_usage_filter.py",
        "test_import_checker.py",
        "test_suite/",
        "profiler/test_profiler_partitions.py",
        "profiler/test_workflow.py",
        "workflow",
        "topology",
    ]
    ignore_args = [f"--ignore=tests/unit/{test}" for test in ignored_tests]

    session.run("pytest", "tests/unit/", *ignore_args)


# TEST PLUGINS
PLUGINS_TESTS = {
    "great-expectations": "tests/unit/great_expectations",
}
PLUGINS = list(PLUGINS_TESTS.keys())


@nox.session(
    name="unit-plugins",
    reuse_venv=True,
    venv_backend="uv|venv",
    python=get_python_versions(),
)
@nox.parametrize("plugin", PLUGINS)
def unit_plugins(session, plugin):
    versions = extract_attribute_from_setup("VERSIONS", "setup.py")

    if not versions:
        session.error("Not able to extract VERSIONS from setup.py")
        session.exit(1)

    if plugin not in versions:
        session.error(
            f"Plugin {plugin} not found in VERSIONS. Available plugins: {list(versions)}"
        )
        session.exit(1)

    session.install(".[test-unit]")
    session.install(versions[plugin])
    # Assuming the plugin has its own tests in a specific directory
    session.run("pytest", PLUGINS_TESTS[plugin])


def extract_attribute_from_setup(attr_name: str, setup_path: str = "setup.py"):
    # TODO: We should consider using a more robust method to extract attributes
    # such as moving out the attributes to a separate file.
    setup_file = Path(setup_path)
    if not setup_file.exists():
        raise FileNotFoundError(f"{setup_path} not found")

    with setup_file.open("r") as f:
        tree = ast.parse(f.read(), filename=setup_path)

    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == attr_name:
                    return ast.literal_eval(node.value)

    return None  # Not found
