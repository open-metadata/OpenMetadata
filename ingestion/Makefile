DIRECTORY_NAME := $(notdir $(CURDIR))
PY_SOURCE ?= ./src

ifeq (ingestion,$(DIRECTORY_NAME))
    INGESTION_DIR := .
    ROOT_DIR := ..
else
    INGESTION_DIR := ingestion
    ROOT_DIR := .
endif

PYTEST_UNIT_WORKERS ?= auto
PYTEST_INTEGRATION_WORKERS ?= 2

# Use uv if available, otherwise fall back to pip
UV := $(shell command -v uv 2> /dev/null)
ifdef UV
    PIP_CMD = uv pip
else
    PIP_CMD = python -m pip
endif

.PHONY: help
help:  ## Show this help message
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

.PHONY: install
install:  ## Install the ingestion module to the current environment
	python -m pip install $(INGESTION_DIR)/

.PHONY: install_dev_env
install_dev_env:  ## Install all dependencies for development (in edit mode)
	pip install --upgrade pip
	pip install nox
	python -m pip install -e "$(INGESTION_DIR)[all-dev-env, dev, test-unit]"

.PHONY: uv_install_dev_env
uv_install_dev_env:  ## Install all dependencies for development using uv (recommended)
	uv sync --extra dev --extra test-unit --extra all-dev-env

.PHONY: install_dev
install_dev:  ## Install the ingestion module with dev dependencies
	$(PIP_CMD) install "$(INGESTION_DIR)[dev]/"

.PHONY: install_test
install_test:  ## Install the ingestion module with test dependencies
	$(PIP_CMD) install "$(INGESTION_DIR)[test]/"

.PHONY: install_all
install_all:  ## Install the ingestion module with all dependencies
	$(PIP_CMD) install "$(INGESTION_DIR)[all]/"

# ---- UV-based targets (recommended for better dependency management) ----
.PHONY: uv_setup
uv_setup:  ## Create .venv using uv and sync all development dependencies
	uv venv .venv
	uv sync --extra dev --extra test

.PHONY: uv_sync
uv_sync:  ## Sync dependencies using uv (uses uv.lock if available)
	uv sync

.PHONY: uv_sync_all
uv_sync_all:  ## Sync all dependencies including all extras using uv
	uv sync --extra all --extra test --extra dev

.PHONY: uv_lock
uv_lock:  ## Update uv.lock file with current dependencies
	uv lock

.PHONY: uv_sync_frozen
uv_sync_frozen:  ## Sync dependencies using frozen lock file (CI/CD)
	uv sync --frozen

.PHONY: uv_install
uv_install:  ## Install the ingestion module using uv
	uv pip install $(INGESTION_DIR)/

.PHONY: install_apis
install_apis:  ## Install the REST APIs module to the current environment
	python -m pip install $(ROOT_DIR)/openmetadata-airflow-apis/ setuptools~=70.3.0

.PHONY: lint
lint:  ## Run pylint on the Python sources to analyze the codebase
	PYTHONPATH="${PYTHONPATH}:$(INGESTION_DIR)/plugins" find $(PY_SOURCE) -path $(PY_SOURCE)/metadata/generated -prune -false -o -type f -name "*.py" | xargs pylint --rcfile=$(INGESTION_DIR)/pyproject.toml

.PHONY: static-checks
static-checks:
	# For Python 3.9, optionally skip SDK type checks if OM_SKIP_SDK_PY39=1
	PY_VER=$$(python -c 'import sys; print(f"{sys.version_info[0]}.{sys.version_info[1]}")'); \
    if [ "$$PY_VER" = "3.9" ] && [ "$$OM_SKIP_SDK_PY39" = "1" ]; then \
        echo "[static-checks] Python $$PY_VER detected with OM_SKIP_SDK_PY39=1 — excluding sdk/ from type checks"; \
        basedpyright $$(find $(INGESTION_DIR)/src/metadata -maxdepth 1 -mindepth 1 -type d \( -not -name sdk -a -not -name __pycache__ \) | tr '\n' ' ') $$(find $(INGESTION_DIR)/src/metadata -maxdepth 1 -type f -name '*.py' | tr '\n' ' '); \
    else \
        basedpyright -p $(INGESTION_DIR)/pyproject.toml; \
    fi

.PHONY: precommit_install
precommit_install:  ## Install the project's precommit hooks from .pre-commit-config.yaml
	@echo "Installing pre-commit hooks"
	@echo "Make sure to first run install_test first"
	pre-commit install

.PHONY: py_format
py_format:  ## Run black and isort to format the Python codebase
	pycln $(INGESTION_DIR)/ $(ROOT_DIR)/openmetadata-airflow-apis/ --config $(INGESTION_DIR)/pyproject.toml
	isort $(INGESTION_DIR)/ $(ROOT_DIR)/openmetadata-airflow-apis/ --settings-file $(INGESTION_DIR)/pyproject.toml
	black $(INGESTION_DIR)/ $(ROOT_DIR)/openmetadata-airflow-apis/ --config $(INGESTION_DIR)/pyproject.toml

.PHONY: py_format_check
py_format_check:  ## Check if Python sources are correctly formatted
	pycln $(INGESTION_DIR)/ $(ROOT_DIR)/openmetadata-airflow-apis/ --diff --config $(INGESTION_DIR)/pyproject.toml
	isort --check-only $(INGESTION_DIR)/ $(ROOT_DIR)/openmetadata-airflow-apis/ --settings-file $(INGESTION_DIR)/pyproject.toml
	black --check --diff $(INGESTION_DIR)/ $(ROOT_DIR)/openmetadata-airflow-apis/ --config $(INGESTION_DIR)/pyproject.toml
	PYTHONPATH="${PYTHONPATH}:$(INGESTION_DIR)/plugins" pylint --rcfile=$(INGESTION_DIR)/pyproject.toml --fail-under=10 $(PY_SOURCE)/metadata || (echo "PyLint error code $$?"; exit 1)

.PHONY: unit_ingestion
unit_ingestion:  ## Run Python unit tests
	coverage run --rcfile $(INGESTION_DIR)/pyproject.toml --parallel-mode --branch -m pytest -n $(PYTEST_UNIT_WORKERS) -c $(INGESTION_DIR)/pyproject.toml --junitxml=$(INGESTION_DIR)/junit/test-results-unit.xml $(INGESTION_DIR)/tests/unit

# FIXME: This is a workaround to exclude the tests that require dependencies that are not straightforward to install
# and might be omitted in unless the we are developing them. This only must be used for local development!
.PHONY: unit_ingestion_dev_env
unit_ingestion_dev_env:  ## Run Python unit tests except some specific ones. Only for local development!
	# Ignores tests:
	# test_ometa_validation_action.py: require great_expectations 0.18.x, the test installs the required package version thus corrupting the environment
	# test_azuresql_sampling.py: requires pymssql, which is not straightforward to install in some platforms
	pytest -c $(INGESTION_DIR)/pyproject.toml $(INGESTION_DIR)/tests/unit \
	 	--ignore=$(INGESTION_DIR)/tests/unit/great_expectations/test_ometa_validation_action.py \
	 	--ignore=$(INGESTION_DIR)/tests/unit/profiler/sqlalchemy/azuresql/test_azuresql_sampling.py \
	 	--ignore-glob="*airflow*"

## Ingestion tests & QA
.PHONY: run_ometa_integration_tests
run_ometa_integration_tests:  ## Run Python integration tests
	# Run parallel-safe tests first, then single-threaded tests
	coverage run --rcfile $(INGESTION_DIR)/pyproject.toml --parallel-mode --branch -m pytest -n $(PYTEST_INTEGRATION_WORKERS) --dist=load -c $(INGESTION_DIR)/pyproject.toml -m "not single_threaded" $(INGESTION_DIR)/tests/integration; \
	coverage run --rcfile $(INGESTION_DIR)/pyproject.toml --parallel-mode --branch -m pytest -c $(INGESTION_DIR)/pyproject.toml -m "single_threaded" --junitxml=$(INGESTION_DIR)/junit/test-results-integration.xml $(INGESTION_DIR)/tests/integration

.PHONY: run_python_tests
run_python_tests:  ## Run all Python tests with coverage
	coverage erase
	$(MAKE) static-checks
	$(MAKE) unit_ingestion
	$(MAKE) run_ometa_integration_tests
	coverage combine --rcfile $(INGESTION_DIR)/pyproject.toml
	coverage report --rcfile $(INGESTION_DIR)/pyproject.toml || true

.PHONY: sonar_ingestion
sonar_ingestion:  ## Run the Sonar analysis based on the tests results and push it to SonarCloud
	docker run \
		--rm \
		-e SONAR_HOST_URL="https://sonarcloud.io" \
		-e SONAR_SCANNER_OPTS="-Xmx1g" \
		-e SONAR_LOGIN=$(token) \
		-v ${PWD}/$(INGESTION_DIR):/usr/src \
		sonarsource/sonar-scanner-cli \
		-Dproject.settings=sonar-project.properties

.PHONY: run_apis_tests
run_apis_tests:  ## Run the openmetadata airflow apis tests
	coverage erase
	coverage run --rcfile $(ROOT_DIR)/openmetadata-airflow-apis/pyproject.toml -a --branch -m pytest -c $(INGESTION_DIR)/pyproject.toml --junitxml=$(ROOT_DIR)/openmetadata-airflow-apis/junit/test-results.xml $(ROOT_DIR)/openmetadata-airflow-apis/tests
	coverage report --rcfile $(ROOT_DIR)/openmetadata-airflow-apis/pyproject.toml

.PHONY: coverage_apis
coverage_apis:  ## Run the python tests on openmetadata-airflow-apis
	$(MAKE) run_apis_tests
	coverage xml --rcfile $(ROOT_DIR)/openmetadata-airflow-apis/pyproject.toml -o $(ROOT_DIR)/openmetadata-airflow-apis/coverage.xml
	sed -e "s/$(shell python -c "import site; import os; from pathlib import Path; print(os.path.relpath(site.getsitepackages()[0], str(Path.cwd())).replace('/','\/'))")\///g" $(ROOT_DIR)/openmetadata-airflow-apis/coverage.xml >> $(ROOT_DIR)/openmetadata-airflow-apis/ci-coverage.xml

.PHONY: coverage
coverage:  ## Run all Python tests and generate the coverage XML report
	$(MAKE) run_python_tests
	coverage combine --rcfile $(INGESTION_DIR)/pyproject.toml
	coverage xml --rcfile $(INGESTION_DIR)/pyproject.toml -o $(INGESTION_DIR)/coverage.xml || true
	sed -e "s/$(shell python -c "import site; import os; from pathlib import Path; print(os.path.relpath(site.getsitepackages()[0], str(Path.cwd())).replace('/','\/'))")/src/g" $(INGESTION_DIR)/coverage.xml >> $(INGESTION_DIR)/ci-coverage.xml

.PHONY: clean-nox
clean-nox:
	rm -rf .nox
