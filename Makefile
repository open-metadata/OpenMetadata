.DEFAULT_GOAL := help
PY_SOURCE ?= ingestion/src

.PHONY: help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[35m%-30s\033[0m %s\n", $$1, $$2}'

.PHONY: env38
env38:
	python3.8 -m venv env38

.PHONY: clean_env37
clean_env37:
	rm -rf env38

.PHONY: install
install:  ## Install the ingestion module to the current environment
	python -m pip install ingestion/

.PHONY: install_apis
install_apis:  ## Install the REST APIs module to the current environment
	python -m pip install openmetadata-airflow-apis/

.PHONY: install_test
install_test:  ## Install the ingestion module with test dependencies
	python -m pip install "ingestion[test]/"

.PHONY: install_dev
install_dev:  ## Install the ingestion module with dev dependencies
	python -m pip install "ingestion[dev]/"

.PHONY: install_all
install_all:  ## Install the ingestion module with all dependencies
	python -m pip install "ingestion[all]/"

.PHONY: precommit_install
precommit_install:  ## Install the project's precommit hooks from .pre-commit-config.yaml
	@echo "Installing pre-commit hooks"
	@echo "Make sure to first run install_test first"
	pre-commit install

.PHONY: lint
lint: ## Run pylint on the Python sources to analyze the codebase
	PYTHONPATH="${PYTHONPATH}:./ingestion/plugins" find $(PY_SOURCE) -path $(PY_SOURCE)/metadata/generated -prune -false -o -type f -name "*.py" | xargs pylint --ignore-paths=$(PY_SOURCE)/metadata_server/

.PHONY: py_format
py_format:  ## Run black and isort to format the Python codebase
	pycln ingestion/ openmetadata-airflow-apis/ --extend-exclude $(PY_SOURCE)/metadata/generated
	isort ingestion/ openmetadata-airflow-apis/ --skip $(PY_SOURCE)/metadata/generated --skip ingestion/env --skip ingestion/build --skip openmetadata-airflow-apis/build --profile black --multi-line 3
	black ingestion/ openmetadata-airflow-apis/ --extend-exclude $(PY_SOURCE)/metadata/generated

.PHONY: py_format_check
py_format_check:  ## Check if Python sources are correctly formatted
	pycln ingestion/ openmetadata-airflow-apis/ --diff --extend-exclude $(PY_SOURCE)/metadata/generated
	isort --check-only ingestion/ openmetadata-airflow-apis/ --skip $(PY_SOURCE)/metadata/generated --skip ingestion/build --profile black --multi-line 3
	black --check --diff ingestion/ openmetadata-airflow-apis/  --extend-exclude $(PY_SOURCE)/metadata/generated
	PYTHONPATH="${PYTHONPATH}:./ingestion/plugins" pylint --fail-under=10 $(PY_SOURCE)/metadata --ignore-paths $(PY_SOURCE)/metadata/generated || (echo "PyLint error code $$?"; exit 1)

## Ingestion models generation
.PHONY: generate
generate:  ## Generate the pydantic models from the JSON Schemas to the ingestion module
	@echo "Running Datamodel Code Generator"
	@echo "Make sure to first run the install_dev recipe"
	rm -rf ingestion/src/metadata/generated
	mkdir -p ingestion/src/metadata/generated
	python scripts/datamodel_generation.py
	$(MAKE) py_antlr js_antlr
	$(MAKE) install

## Ingestion tests & QA
.PHONY: run_ometa_integration_tests
run_ometa_integration_tests:  ## Run Python integration tests
	coverage run --rcfile ingestion/.coveragerc -a --branch -m pytest -c ingestion/setup.cfg --junitxml=ingestion/junit/test-results-integration.xml ingestion/tests/integration/ometa ingestion/tests/integration/orm_profiler ingestion/tests/integration/test_suite ingestion/tests/integration/data_insight ingestion/tests/integration/lineage

.PHONY: unit_ingestion
unit_ingestion:  ## Run Python unit tests
	coverage run --rcfile ingestion/.coveragerc -a --branch -m pytest -c ingestion/setup.cfg --junitxml=ingestion/junit/test-results-unit.xml --ignore=ingestion/tests/unit/source ingestion/tests/unit

.PHONY: run_python_tests
run_python_tests:  ## Run all Python tests with coverage
	coverage erase
	$(MAKE) unit_ingestion
	$(MAKE) run_ometa_integration_tests
	coverage report --rcfile ingestion/.coveragerc || true

.PHONY: coverage
coverage:  ## Run all Python tests and generate the coverage XML report
	$(MAKE) run_python_tests
	coverage xml --rcfile ingestion/.coveragerc -o ingestion/coverage.xml || true
	sed -e "s/$(shell python -c "import site; import os; from pathlib import Path; print(os.path.relpath(site.getsitepackages()[0], str(Path.cwd())).replace('/','\/'))")/src/g" ingestion/coverage.xml >> ingestion/ci-coverage.xml

.PHONY: sonar_ingestion
sonar_ingestion:  ## Run the Sonar analysis based on the tests results and push it to SonarCloud
	docker run \
		--rm \
		-e SONAR_HOST_URL="https://sonarcloud.io" \
		-e SONAR_SCANNER_OPTS="-Xmx1g" \
		-e SONAR_LOGIN=$(token) \
		-v ${PWD}/ingestion:/usr/src \
		sonarsource/sonar-scanner-cli \
		-Dproject.settings=sonar-project.properties

.PHONY: run_apis_tests
run_apis_tests:  ## Run the openmetadata airflow apis tests
	coverage erase
	coverage run --rcfile openmetadata-airflow-apis/.coveragerc -a --branch -m pytest --junitxml=openmetadata-airflow-apis/junit/test-results.xml openmetadata-airflow-apis/tests
	coverage report --rcfile openmetadata-airflow-apis/.coveragerc

.PHONY: coverage_apis
coverage_apis:  ## Run the python tests on openmetadata-airflow-apis
	$(MAKE) run_apis_tests
	coverage xml --rcfile openmetadata-airflow-apis/.coveragerc -o openmetadata-airflow-apis/coverage.xml
	sed -e "s/$(shell python -c "import site; import os; from pathlib import Path; print(os.path.relpath(site.getsitepackages()[0], str(Path.cwd())).replace('/','\/'))")\///g" openmetadata-airflow-apis/coverage.xml >> openmetadata-airflow-apis/ci-coverage.xml

## Ingestion publish
.PHONY: publish
publish:  ## Publish the ingestion module to PyPI
	$(MAKE) install_dev generate
	cd ingestion; \
	  python setup.py install sdist bdist_wheel; \
	  twine check dist/*; \
	  twine upload dist/*

## Yarn
.PHONY: yarn_install_cache
yarn_install_cache:  ## Use Yarn to install UI dependencies
	cd openmetadata-ui/src/main/resources/ui && yarn install --frozen-lockfile

.PHONY: yarn_start_dev_ui
yarn_start_dev_ui:  ## Run the UI locally with Yarn
	cd openmetadata-ui/src/main/resources/ui && yarn start

## Ingestion Core
.PHONY: core_install_dev
core_install_dev:  ## Prepare a venv for the ingestion-core module
	cd ingestion-core; \
		rm -rf venv; \
		python3 -m venv venv; \
		. venv/bin/activate; \
		python3 -m pip install ".[dev]"

.PHONY: core_clean
core_clean:  ## Clean the ingestion-core generated files
	rm -rf ingestion-core/src/metadata/generated
	rm -rf ingestion-core/build
	rm -rf ingestion-core/dist

.PHONY: core_generate
core_generate:  ## Generate the pydantic models from the JSON Schemas to the ingestion-core module
	$(MAKE) core_install_dev
	mkdir -p ingestion-core/src/metadata/generated; \
	. ingestion-core/venv/bin/activate; \
	datamodel-codegen --input openmetadata-spec/src/main/resources/json/schema  --input-file-type jsonschema --output ingestion-core/src/metadata/generated/schema
	$(MAKE) core_py_antlr

.PHONY: core_bump_version_dev
core_bump_version_dev:  ## Bump a `dev` version to the ingestion-core module. To be used when schemas are updated
	$(MAKE) core_install_dev
	cd ingestion-core; \
		. venv/bin/activate; \
		python -m incremental.update metadata --dev

.PHONY: core_publish
core_publish:  ## Install, generate and publish the ingestion-core module to Test PyPI
	$(MAKE) core_clean core_generate
	cd ingestion-core; \
		. venv/bin/activate; \
		python setup.py install sdist bdist_wheel; \
		twine check dist/*; \
		twine upload -r testpypi dist/*

.PHONY: core_py_antlr
core_py_antlr:  ## Generate the Python core code for parsing FQNs under ingestion-core
	antlr4 -Dlanguage=Python3 -o ingestion-core/src/metadata/generated/antlr ${PWD}/openmetadata-spec/src/main/antlr4/org/openmetadata/schema/*.g4

.PHONY: py_antlr
py_antlr:  ## Generate the Python code for parsing FQNs
	antlr4 -Dlanguage=Python3 -o ingestion/src/metadata/generated/antlr ${PWD}/openmetadata-spec/src/main/antlr4/org/openmetadata/schema/*.g4

.PHONY: js_antlr
js_antlr:  ## Generate the Python code for parsing FQNs
	antlr4 -Dlanguage=JavaScript -o openmetadata-ui/src/main/resources/ui/src/generated/antlr ${PWD}/openmetadata-spec/src/main/antlr4/org/openmetadata/schema/*.g4


.PHONY: install_antlr_cli
install_antlr_cli:  ## Install antlr CLI locally
	echo '#!/usr/bin/java -jar' > /usr/local/bin/antlr4
	curl https://www.antlr.org/download/antlr-4.9.2-complete.jar >> /usr/local/bin/antlr4
	chmod 755 /usr/local/bin/antlr4

.PHONY: docker-docs
docker-docs:  ## Runs the OM docs in docker passing openmetadata-docs as volume for content and images
	docker run --name openmetadata-docs -p 3000:3000 -v ${PWD}/openmetadata-docs/content:/docs/content/ -v ${PWD}/openmetadata-docs/images:/docs/public/images openmetadata/docs:latest

.PHONY: docker-docs-validate
docker-docs-validate:  ## Runs the OM docs in docker passing openmetadata-docs as volume for content and images
	docker run --entrypoint '/bin/sh' -v ${PWD}/openmetadata-docs/content:/docs/content/ -v ${PWD}/openmetadata-docs/images:/docs/public/images openmetadata/docs:latest -c 'npm run export'

.PHONY: docker-docs-local
docker-docs-local:  ## Runs the OM docs in docker with a local image
	docker run --name openmetadata-docs -p 3000:3000 -v ${PWD}/openmetadata-docs/content:/docs/content/ -v ${PWD}/openmetadata-docs/images:/docs/public/images openmetadata-docs:local


## SNYK
SNYK_ARGS := --severity-threshold=high

.PHONY: snyk-ingestion-report
snyk-ingestion-report:  ## Uses Snyk CLI to validate the ingestion code and container. Don't stop the execution
	@echo "Validating Ingestion container..."
	docker build -t openmetadata-ingestion:scan -f ingestion/Dockerfile .
	snyk container test openmetadata-ingestion:scan --file=ingestion/Dockerfile $(SNYK_ARGS) --json > security-report/ingestion-docker-scan.json | true;
	@echo "Validating ALL ingestion dependencies. Make sure the venv is activated."
	cd ingestion; \
		pip freeze > scan-requirements.txt; \
		snyk test --file=scan-requirements.txt --package-manager=pip --command=python3 $(SNYK_ARGS) --json > ../security-report/ingestion-dep-scan.json | true; \
		snyk code test $(SNYK_ARGS) --json > ../security-report/ingestion-code-scan.json | true;

.PHONY: snyk-airflow-apis-report
snyk-airflow-apis-report:  ## Uses Snyk CLI to validate the airflow apis code. Don't stop the execution
	@echo "Validating airflow dependencies. Make sure the venv is activated."
	cd openmetadata-airflow-apis; \
    	snyk code test $(SNYK_ARGS) --json > ../security-report/airflow-apis-code-scan.json | true;

.PHONY: snyk-catalog-report
snyk-server-report:  ## Uses Snyk CLI to validate the catalog code and container. Don't stop the execution
	@echo "Validating catalog container... Make sure the code is built and available under openmetadata-dist"
	docker build -t openmetadata-server:scan -f docker/local-metadata/Dockerfile .
	snyk container test openmetadata-server:scan --file=docker/local-metadata/Dockerfile $(SNYK_ARGS) --json > security-report/server-docker-scan.json | true;
	snyk test --all-projects $(SNYK_ARGS) --json > security-report/server-dep-scan.json | true;
	snyk code test --all-projects --severity-threshold=high --json > security-report/server-code-scan.json | true;

.PHONY: snyk-ui-report
snyk-ui-report:  ## Uses Snyk CLI to validate the UI dependencies. Don't stop the execution
	snyk test --file=openmetadata-ui/src/main/resources/ui/yarn.lock $(SNYK_ARGS) --json > security-report/ui-dep-scan.json | true;

.PHONY: snyk-dependencies-report
snyk-dependencies-report:  ## Uses Snyk CLI to validate the project dependencies: MySQL, Postgres and ES. Only local testing.
	@echo "Validating dependencies images..."
	snyk container test mysql/mysql-server:latest $(SNYK_ARGS) --json > security-report/mysql-scan.json | true;
	snyk container test postgres:latest $(SNYK_ARGS) --json > security-report/postgres-scan.json | true;
	snyk container test docker.elastic.co/elasticsearch/elasticsearch:7.10.2 $(SNYK_ARGS) --json > security-report/es-scan.json | true;

.PHONY: snyk-report
snyk-report:  ## Uses Snyk CLI to run a security scan of the different pieces of the code
	@echo "To run this locally, make sure to install and authenticate using the Snyk CLI: https://docs.snyk.io/snyk-cli/install-the-snyk-cli"
	rm -rf security-report
	mkdir -p security-report
	$(MAKE) snyk-ingestion-report
	$(MAKE) snyk-airflow-apis-report
	$(MAKE) snyk-server-report
	$(MAKE) snyk-ui-report
	$(MAKE)	export-snyk-html-report

.PHONY: export-snyk-html-report
export-snyk-html-report:  ## export json file from security-report/ to HTML
	@echo "Reading all results"
	npm install snyk-to-html -g
	ls security-report | xargs -I % snyk-to-html -i security-report/% -o security-report/%.html

# Ingestion Operators
.PHONY: build-ingestion-base-local
build-ingestion-base-local:  ## Builds the ingestion DEV docker operator with the local ingestion files
	$(MAKE) install_dev generate
	docker build -f ingestion/operators/docker/Dockerfile-dev . -t openmetadata/ingestion-base:local
