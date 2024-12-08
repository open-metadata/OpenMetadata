DIRECTORY_NAME := $(notdir $(CURDIR))

ifeq (openmetadata-airflow-apis,$(DIRECTORY_NAME))
    API_DIR := .
	ROOT_DIR := ..
else
    API_DIR := openmetadata-airflow-apis
	ROOT_DIR := .
endif

.PHONY: install_apis
install_apis:  ## Install the REST APIs module to the current environment
	python -m pip install $(API_DIR)/ setuptools~=70.3.0

.PHONY: run_apis_tests
run_apis_tests:  ## Run the openmetadata airflow apis tests
	coverage erase
	coverage run --rcfile $(ROOT_DIR)/ingestion/pyproject.toml -a --branch -m pytest -c $(ROOT_DIR)/ingestion/pyproject.toml --junitxml=$(API_DIR)/junit/test-results.xml $(API_DIR)/tests
	coverage report --rcfile $(ROOT_DIR)/ingestion/pyproject.toml

.PHONY: coverage_apis
coverage_apis:  ## Run the python tests on openmetadata-airflow-apis
	$(MAKE) run_apis_tests
	coverage xml --rcfile $(ROOT_DIR)/ingestion/pyproject.toml -o $(API_DIR)/coverage.xml
	sed -e "s/$(shell python -c "import site; import os; from pathlib import Path; print(os.path.relpath(site.getsitepackages()[0], str(Path.cwd())).replace('/','\/'))")\///g" $(ROOT_DIR)/openmetadata-airflow-apis/coverage.xml >> $(ROOT_DIR)/openmetadata-airflow-apis/ci-coverage.xml
