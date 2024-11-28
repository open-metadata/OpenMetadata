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
	python -m pip install $(INGESTION_DIR)/

.PHONY: install_dev
install_dev:  ## Install the ingestion module with dev dependencies
	python -m pip install "$(INGESTION_DIR)[dev,test]/"

.PHONY: install_test
install_test:  ## Install the ingestion module with test dependencies
	python -m pip install "$(INGESTION_DIR)[test]/"

.PHONY: install_all
install_all:  ## Install the ingestion module with all dependencies
	python -m pip install "$(INGESTION_DIR)[all]/"

.PHONY: lint
lint:  ## Run pylint on the Python sources to analyze the codebase
	PYTHONPATH="${PYTHONPATH}:$(INGESTION_DIR)/plugins" find $(PY_SOURCE) -path $(PY_SOURCE)/metadata/generated -prune -false -o -type f -name "*.py" | xargs pylint --rcfile=$(INGESTION_DIR)/pyproject.toml

.PHONY: static-checks
static-checks:
	basedpyright -p $(INGESTION_DIR)/pyproject.toml

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

.PHONY: run_integration_and_unit_tests
run_integration_and_unit_tests:  ## Run Python unite and integration tests
	coverage run --rcfile $(INGESTION_DIR)/pyproject.toml -a --branch -m pytest -c $(INGESTION_DIR)/pyproject.toml --junitxml=$(INGESTION_DIR)/junit/test-results-all.xml $(INGESTION_DIR)/tests/unit $(INGESTION_DIR)/tests/integration

.PHONY: run_python_tests
run_python_tests:  ## Run all Python tests with coverage
	coverage erase
	$(MAKE) static-checks
	$(MAKE) run_integration_and_unit_tests
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

.PHONY: coverage
coverage:  ## Run all Python tests and generate the coverage XML report
	$(MAKE) run_python_tests
	coverage xml --rcfile $(INGESTION_DIR)/pyproject.toml -o $(INGESTION_DIR)/coverage.xml || true
	sed -e "s/$(shell python -c "import site; import os; from pathlib import Path; print(os.path.relpath(site.getsitepackages()[0], str(Path.cwd())).replace('/','\/'))")/src/g" $(INGESTION_DIR)/coverage.xml >> $(INGESTION_DIR)/ci-coverage.xml
