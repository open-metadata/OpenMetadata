DIRECTORY_NAME := $(notdir $(CURDIR))

ifeq (ingestion,$(DIRECTORY_NAME))
    INGESTION_DIR := .
    ROOT_DIR := ..
else
    INGESTION_DIR := ingestion
    ROOT_DIR := .
endif

PYTHON ?= python3
INGESTION_ABS := $(abspath $(INGESTION_DIR))
NOX_BOOTSTRAP := $(INGESTION_ABS)/.nox/bootstrap
NOX = "$(NOX_BOOTSTRAP)/bin/nox" -f "$(INGESTION_ABS)/noxfile.py"
export OM_VENV_DIR

PYTHON_TEST_PROFILE ?= test-classification
PYTHON_PROFILE ?= runtime

.PHONY: install
install: python_tools  ## Install a locked Python profile
	$(NOX) -s install -- $(PYTHON_PROFILE)

.PHONY: python_tools
python_tools:  ## Bootstrap the locked Nox tools without installing the application
	@$(PYTHON) "$(INGESTION_ABS)/../scripts/python_tools.py" bootstrap

.PHONY: install_dev_env
install_dev_env: install_test  ## Install the locked development and test environment

.PHONY: install_dev
install_dev: python_tools  ## Install the ingestion module with dev dependencies
	$(NOX) -s install -- dev

.PHONY: install_test
install_test: python_tools  ## Install the ingestion module with test dependencies
	$(NOX) -s install -- $(PYTHON_TEST_PROFILE)

.PHONY: install_all
install_all: python_tools  ## Install the ingestion module with all dependencies
	$(NOX) -s install -- all

.PHONY: install_apis
install_apis:  ## Install the REST APIs module to the current environment
	python -m pip install $(ROOT_DIR)/openmetadata-airflow-apis/ "setuptools>=83"

.PHONY: static-checks
static-checks: python_tools  ## Run basedpyright type checks (delegates to nox so local matches CI)
	$(NOX) --no-venv -s static-checks -- $(ARGS)

.PHONY: precommit_install
precommit_install: python_tools  ## Install the project's precommit hooks from .pre-commit-config.yaml
	@echo "Installing pre-commit hooks"
	$(NOX) -s precommit-install

.PHONY: py_format
py_format: python_tools  ## Run ruff to lint-fix and format the Python codebase
	$(NOX) --no-venv -s lint -- --fix

.PHONY: py_format_check
py_format_check: python_tools  ## Check if Python sources are correctly formatted
	$(NOX) --no-venv -s lint

.PHONY: generate_settings_docs
generate_settings_docs: python_tools  ## Regenerate ingestion/SETTINGS.md from the OM_ settings classes
	$(NOX) -s generate-settings-docs

.PHONY: check_import_layers
check_import_layers: python_tools  ## Fail if a module imports a higher layer (import-cost guard, see ingestion/.importlinter)
	$(NOX) -s check-import-layers

.PHONY: unit_ingestion
unit_ingestion: python_tools  ## Run Python unit tests
	$(NOX) --no-venv -s unit-tests -- $(ARGS)

.PHONY: unit_ingestion_dev_env
unit_ingestion_dev_env: unit_ingestion  ## Compatibility alias for unit_ingestion

## Ingestion tests & QA
.PHONY: run_ometa_integration_tests
run_ometa_integration_tests: python_tools  ## Run Python integration tests
	$(NOX) --no-venv -s integration-tests -- $(ARGS)

.PHONY: run_python_tests
run_python_tests: python_tools  ## Run all Python tests with coverage
	$(NOX) -s coverage -- erase
	$(MAKE) unit_ingestion
	$(MAKE) run_ometa_integration_tests
	$(NOX) -s coverage -- report

.PHONY: sonar_ingestion
sonar_ingestion: python_tools  ## Run the Sonar analysis based on the tests results and push it to SonarCloud
	versions=$$("$(NOX_BOOTSTRAP)/bin/python" "$(ROOT_DIR)/scripts/python_ci.py" versions --project "$(INGESTION_ABS)" --csv) && \
	docker run \
		--rm \
		-e SONAR_HOST_URL="https://sonarcloud.io" \
		-e SONAR_SCANNER_OPTS="-Xmx1g" \
		-e SONAR_LOGIN=$(token) \
		-v "$(INGESTION_ABS):/usr/src" \
		sonarsource/sonar-scanner-cli \
		-Dproject.settings=sonar-project.properties \
		-Dsonar.python.version="$$versions"

.PHONY: run_apis_tests
run_apis_tests:  ## Run the openmetadata airflow apis tests
	$(MAKE) -C $(ROOT_DIR)/openmetadata-airflow-apis test

.PHONY: coverage_apis
coverage_apis:  ## Run the python tests on openmetadata-airflow-apis
	$(MAKE) -C $(ROOT_DIR)/openmetadata-airflow-apis coverage

.PHONY: coverage
coverage: python_tools  ## Run all Python tests and generate the coverage XML report
	$(MAKE) run_python_tests
	$(NOX) -s coverage -- xml
	sed 's|filename="[^"]*/site-packages/metadata/|filename="src/metadata/|g' $(INGESTION_DIR)/coverage.xml > $(INGESTION_DIR)/ci-coverage.xml

.PHONY: clean-nox
clean-nox:
	rm -rf "$(INGESTION_ABS)/.nox"
