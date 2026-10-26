DIRECTORY_NAME := $(notdir $(CURDIR))
PY_SOURCE ?= ./src

ifeq (ingestion,$(DIRECTORY_NAME))
    INGESTION_DIR := .
    ROOT_DIR := ..
else
    INGESTION_DIR := ingestion
    ROOT_DIR := .
endif

PYTHON ?= python3
PYTHON_RUNNER := $(abspath $(ROOT_DIR))/scripts/python_environment.py
PYTHON_RUN = $(PYTHON) "$(PYTHON_RUNNER)"
INGESTION_ABS := $(abspath $(INGESTION_DIR))
ROOT_ABS := $(abspath $(ROOT_DIR))
PYTHON_TOOLING_SCRIPTS := $(wildcard $(addprefix $(ROOT_ABS)/scripts/, \
    python_environment.py generate_ingestion_models.py refresh_python_dependencies.py review_python_constraints.py \
    build_python_artifacts.py python_artifact_smoke.py python_image_environment.py)) \
    $(wildcard $(ROOT_ABS)/.github/scripts/python_ci.py)

.PHONY: install
install:  ## Install the ingestion module to the current environment
	$(PYTHON_RUN) --profile runtime

.PHONY: install_dev
install_dev:  ## Install the ingestion module with dev dependencies
	$(PYTHON_RUN) --profile dev

.PHONY: install_test
install_test:  ## Install the ingestion module with test dependencies
	$(PYTHON_RUN) --profile test

.PHONY: install_all
install_all:  ## Install the ingestion module with all dependencies
	$(PYTHON_RUN) --profile all

.PHONY: install_apis
install_apis:  ## Install the REST APIs module to the current environment
	uv pip install $(ROOT_DIR)/openmetadata-airflow-apis/ "setuptools~=70.3.0"

.PHONY: static-checks
static-checks:  ## Run basedpyright type checks (delegates to nox so local matches CI)
	$(PYTHON_RUN) --profile test -- nox -f "$(INGESTION_ABS)/noxfile.py" --no-venv -s static-checks -- $(ARGS)

.PHONY: precommit_install
precommit_install:  ## Install the project's precommit hooks from .pre-commit-config.yaml
	@echo "Installing pre-commit hooks"
	$(PYTHON_RUN) --profile dev --environment "$(INGESTION_ABS)/.nox/dev-tools" -- pre-commit install

.PHONY: py_format
py_format:  ## Run ruff to lint-fix and format the Python codebase
	$(PYTHON_RUN) --profile style -- ruff check --fix "$(INGESTION_ABS)" "$(ROOT_ABS)/openmetadata-airflow-apis" $(PYTHON_TOOLING_SCRIPTS) --config "$(INGESTION_ABS)/pyproject.toml"
	$(PYTHON_RUN) --profile style -- python "$(INGESTION_ABS)/scripts/check_ruff_suppressions.py" --prune
	$(PYTHON_RUN) --profile style -- ruff format "$(INGESTION_ABS)" "$(ROOT_ABS)/openmetadata-airflow-apis" $(PYTHON_TOOLING_SCRIPTS) --config "$(INGESTION_ABS)/pyproject.toml"

.PHONY: py_format_check
py_format_check:  ## Check if Python sources are correctly formatted
	$(PYTHON_RUN) --profile style -- ruff check "$(INGESTION_ABS)" "$(ROOT_ABS)/openmetadata-airflow-apis" $(PYTHON_TOOLING_SCRIPTS) --config "$(INGESTION_ABS)/pyproject.toml"
	$(PYTHON_RUN) --profile style -- python "$(INGESTION_ABS)/scripts/check_ruff_suppressions.py" --check
	$(PYTHON_RUN) --profile style -- ruff format --check "$(INGESTION_ABS)" "$(ROOT_ABS)/openmetadata-airflow-apis" $(PYTHON_TOOLING_SCRIPTS) --config "$(INGESTION_ABS)/pyproject.toml"

.PHONY: generate_settings_docs
generate_settings_docs:  ## Regenerate ingestion/SETTINGS.md from the OM_ settings classes
	$(PYTHON_RUN) --profile dev --environment "$(INGESTION_ABS)/.nox/dev-tools" -- python "$(INGESTION_ABS)/scripts/generate_settings_docs.py"

.PHONY: check_import_layers
check_import_layers:  ## Fail if a module imports a higher layer (import-cost guard, see ingestion/.importlinter)
	$(PYTHON_RUN) --profile dev --environment "$(INGESTION_ABS)/.nox/dev-tools" --cwd "$(INGESTION_ABS)" -- lint-imports

.PHONY: unit_ingestion
unit_ingestion:  ## Run Python unit tests
	$(PYTHON_RUN) --profile test -- nox -f "$(INGESTION_ABS)/noxfile.py" --no-venv -s unit-tests -- $(ARGS)

# FIXME: This is a workaround to exclude the tests that require dependencies that are not straightforward to install
# and might be omitted in unless the we are developing them. This only must be used for local development!
## Ingestion tests & QA
.PHONY: run_ometa_integration_tests
run_ometa_integration_tests:  ## Run Python integration tests
	$(PYTHON_RUN) --profile test -- nox -f "$(INGESTION_ABS)/noxfile.py" --no-venv -s integration-tests -- $(ARGS)

.PHONY: run_python_tests
run_python_tests:  ## Run all Python tests with coverage
	$(PYTHON_RUN) --profile coverage --cwd "$(INGESTION_ABS)" -- coverage erase --rcfile pyproject.toml
	$(MAKE) unit_ingestion
	$(MAKE) run_ometa_integration_tests
	$(PYTHON_RUN) --profile coverage --cwd "$(INGESTION_ABS)" -- coverage report --rcfile pyproject.toml

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
	coverage run --rcfile $(ROOT_DIR)/openmetadata-airflow-apis/pyproject.toml --branch -m pytest -c $(INGESTION_DIR)/pyproject.toml --junitxml=$(ROOT_DIR)/openmetadata-airflow-apis/junit/test-results.xml $(ROOT_DIR)/openmetadata-airflow-apis/tests
	coverage report --rcfile $(ROOT_DIR)/openmetadata-airflow-apis/pyproject.toml

.PHONY: coverage_apis
coverage_apis:  ## Run the python tests on openmetadata-airflow-apis
	$(MAKE) run_apis_tests
	coverage xml --rcfile $(ROOT_DIR)/openmetadata-airflow-apis/pyproject.toml -o $(ROOT_DIR)/openmetadata-airflow-apis/coverage.xml
	sed -e "s/$(shell python -c "import site; import os; from pathlib import Path; print(os.path.relpath(site.getsitepackages()[0], str(Path.cwd())).replace('/','\/'))")\///g" $(ROOT_DIR)/openmetadata-airflow-apis/coverage.xml >> $(ROOT_DIR)/openmetadata-airflow-apis/ci-coverage.xml

.PHONY: coverage
coverage:  ## Run all Python tests and generate the coverage XML report
	$(MAKE) run_python_tests
	$(PYTHON_RUN) --profile coverage --cwd "$(INGESTION_ABS)" -- coverage xml --rcfile pyproject.toml -o coverage.xml
	sed 's|filename="[^"]*/site-packages/metadata/|filename="src/metadata/|g' $(INGESTION_DIR)/coverage.xml > $(INGESTION_DIR)/ci-coverage.xml

.PHONY: clean-nox
clean-nox:
	rm -rf "$(INGESTION_ABS)/.nox"
