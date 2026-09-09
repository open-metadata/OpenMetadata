DIRECTORY_NAME := $(notdir $(CURDIR))
PY_SOURCE ?= ./src

ifeq (ingestion,$(DIRECTORY_NAME))
    INGESTION_DIR := .
    ROOT_DIR := ..
else
    INGESTION_DIR := ingestion
    ROOT_DIR := .
endif

.PHONY: install
install:  ## Install the ingestion module to the current environment
	uv pip install $(INGESTION_DIR)/

.PHONY: install_dev
install_dev:  ## Install the ingestion module with dev dependencies
	uv pip install -e "$(INGESTION_DIR)/"
	uv pip install --group "$(INGESTION_DIR)/pyproject.toml:dev"

.PHONY: install_test
install_test:  ## Install the ingestion module with test dependencies
	uv pip install -e "$(INGESTION_DIR)[all,airflow,great-expectations]"
	uv pip install --group "$(INGESTION_DIR)/pyproject.toml:test"

.PHONY: install_all
install_all:  ## Install the ingestion module with all dependencies
	uv pip install "$(INGESTION_DIR)[all]"

.PHONY: install_apis
install_apis:  ## Install the REST APIs module to the current environment
	uv pip install $(ROOT_DIR)/openmetadata-airflow-apis/ "setuptools~=70.3.0"

.PHONY: static-checks
static-checks:  ## Run basedpyright type checks (delegates to nox so local matches CI)
	cd $(INGESTION_DIR) && nox --no-venv -s static-checks

.PHONY: precommit_install
precommit_install:  ## Install the project's precommit hooks from .pre-commit-config.yaml
	@echo "Installing pre-commit hooks"
	@echo "Make sure to first run install_test first"
	pre-commit install

.PHONY: py_format
py_format:  ## Run ruff to lint-fix and format the Python codebase
	ruff check --fix $(INGESTION_DIR)/ $(ROOT_DIR)/openmetadata-airflow-apis/ --config $(INGESTION_DIR)/pyproject.toml
	ruff format $(INGESTION_DIR)/ $(ROOT_DIR)/openmetadata-airflow-apis/ --config $(INGESTION_DIR)/pyproject.toml

.PHONY: py_format_check
py_format_check:  ## Check if Python sources are correctly formatted
	ruff check $(INGESTION_DIR)/ $(ROOT_DIR)/openmetadata-airflow-apis/ --config $(INGESTION_DIR)/pyproject.toml
	ruff format --check $(INGESTION_DIR)/ $(ROOT_DIR)/openmetadata-airflow-apis/ --config $(INGESTION_DIR)/pyproject.toml

.PHONY: generate_settings_docs
generate_settings_docs:  ## Regenerate ingestion/SETTINGS.md from the OM_ settings classes
	python $(INGESTION_DIR)/scripts/generate_settings_docs.py

.PHONY: check_import_layers
check_import_layers:  ## Fail if a module imports a higher layer (import-cost guard, see ingestion/.importlinter)
	cd $(INGESTION_DIR) && lint-imports

.PHONY: unit_ingestion
unit_ingestion:  ## Run Python unit tests
	cd $(INGESTION_DIR) && nox --no-venv -s unit-tests

# FIXME: This is a workaround to exclude the tests that require dependencies that are not straightforward to install
# and might be omitted in unless the we are developing them. This only must be used for local development!
## Ingestion tests & QA
.PHONY: run_ometa_integration_tests
run_ometa_integration_tests:  ## Run Python integration tests
	cd $(INGESTION_DIR) && nox --no-venv -s integration-tests

.PHONY: run_python_tests
run_python_tests:  ## Run all Python tests with coverage
	coverage erase
	$(MAKE) unit_ingestion
	$(MAKE) run_ometa_integration_tests
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
	coverage xml --rcfile $(INGESTION_DIR)/pyproject.toml -o $(INGESTION_DIR)/coverage.xml || true
	sed 's|filename="[^"]*\(/metadata/[^"]*"\)|filename="src\1|g' $(INGESTION_DIR)/coverage.xml > $(INGESTION_DIR)/ci-coverage.xml

.PHONY: clean-nox
clean-nox:
	rm -rf .nox
