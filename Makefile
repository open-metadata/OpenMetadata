.DEFAULT_GOAL := help
PY_SOURCE ?= ingestion/src
include ingestion/Makefile

.PHONY: help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":"}; {printf "\033[35m%-35s\033[0m %s\n", $$2, $$3}'

.PHONY: prerequisites
prerequisites:
	./scripts/check_prerequisites.sh

.PHONY: install_e2e_tests
install_e2e_tests:  ## Install the ingestion module with e2e test dependencies (playwright)
	python -m pip install "ingestion[e2e_test]/"
	playwright install --with-deps

.PHONY: run_e2e_tests
run_e2e_tests: ## Run e2e tests
	pytest --screenshot=only-on-failure --output="ingestion/tests/e2e/artifacts" $(ARGS) --slowmo 5 --junitxml=ingestion/junit/test-results-e2e.xml ingestion/tests/e2e

## Yarn
.PHONY: yarn_install_cache
yarn_install_cache:  ## Use Yarn to install UI dependencies
	cd openmetadata-ui/src/main/resources/ui && yarn install --frozen-lockfile

.PHONY: yarn_start_dev_ui
yarn_start_dev_ui:  ## Run the UI locally with Yarn
	cd openmetadata-ui/src/main/resources/ui && yarn start

.PHONY: yarn_start_e2e
yarn_start_e2e:  ## Run the e2e tests locally with Yarn
	cd openmetadata-ui/src/main/resources/ui && yarn playwright:run

.PHONY: yarn_start_e2e_ui
yarn_start_e2e_ui:  ## Run the e2e tests locally in UI mode with Yarn
	cd openmetadata-ui/src/main/resources/ui && yarn playwright:open

.PHONY: yarn_start_e2e_codegen
yarn_start_e2e_codegen:  ## generate playwright code
	cd openmetadata-ui/src/main/resources/ui && yarn playwright:codegen
	
.PHONY: py_antlr
py_antlr:  ## Generate the Python code for parsing FQNs
	antlr4 -Dlanguage=Python3 -o ingestion/src/metadata/generated/antlr ${PWD}/openmetadata-spec/src/main/antlr4/org/openmetadata/schema/*.g4

.PHONY: js_antlr
js_antlr:  ## Generate the Python code for parsing FQNs
	antlr4 -Dlanguage=JavaScript -o openmetadata-ui/src/main/resources/ui/src/generated/antlr ${PWD}/openmetadata-spec/src/main/antlr4/org/openmetadata/schema/*.g4

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

.PHONY: install_antlr_cli
install_antlr_cli:  ## Install antlr CLI locally
	echo '#!/usr/bin/java -jar' > /usr/local/bin/antlr4
	curl https://www.antlr.org/download/antlr-4.9.2-complete.jar >> /usr/local/bin/antlr4
	chmod 755 /usr/local/bin/antlr4

.PHONY: docker-docs-local
docker-docs-local:  ## Runs the OM docs in docker with a local image
	docker run --name openmetadata-docs -p 3000:3000 -v ${PWD}/openmetadata-docs/content:/docs/content/ -v ${PWD}/openmetadata-docs/images:/docs/public/images openmetadata-docs:local yarn dev

.PHONY: docker-docs
docker-docs:  ## Runs the OM docs in docker passing openmetadata-docs-v1 as volume for content and images
	docker pull openmetadata/docs:latest
	docker run --name openmetadata-docs -p 3000:3000 -v ${PWD}/openmetadata-docs/content:/docs/content/ -v ${PWD}/openmetadata-docs/images:/docs/public/images openmetadata/docs:latest yarn dev

.PHONY: docker-docs-validate
docker-docs-validate:  ## Runs the OM docs in docker passing openmetadata-docs as volume for content and images
	docker pull openmetadata/docs-v1:latest
	docker run --entrypoint '/bin/sh' -v ${PWD}/openmetadata-docs/content:/docs/content/ -v ${PWD}/openmetadata-docs/images:/docs/public/images openmetadata/docs:latest -c 'yarn build'

## SNYK
SNYK_ARGS := --severity-threshold=high

.PHONY: snyk-ingestion-report
snyk-ingestion-report:  ## Uses Snyk CLI to validate the ingestion code and container. Don't stop the execution
	@echo "Validating Ingestion container..."
	docker build -t openmetadata-ingestion:scan -f ingestion/Dockerfile.ci .
	snyk container test openmetadata-ingestion:scan --file=ingestion/Dockerfile.ci $(SNYK_ARGS) --json > security-report/ingestion-docker-scan.json | true;
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
	docker build -t openmetadata-server:scan -f docker/development/Dockerfile .
	snyk container test openmetadata-server:scan --file=docker/development/Dockerfile $(SNYK_ARGS) --json > security-report/server-docker-scan.json | true;
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

.PHONY: snyk-ingestion-base-slim-report
snyk-ingestion-base-slim-report:
	@echo "Validating Ingestion Slim Container"
	docker build -t openmetadata-ingestion-base-slim:scan -f ingestion/operators/docker/Dockerfile.ci --build-arg INGESTION_DEPENDENCY=slim .
	snyk container test openmetadata-ingestion-base-slim:scan --file=ingestion/operators/docker/Dockerfile.ci $(SNYK_ARGS) --json > security-report/ingestion-docker-base-slim-scan.json | true;

.PHONY: snyk-report
snyk-report:  ## Uses Snyk CLI to run a security scan of the different pieces of the code
	@echo "To run this locally, make sure to install and authenticate using the Snyk CLI: https://docs.snyk.io/snyk-cli/install-the-snyk-cli"
	rm -rf security-report
	mkdir -p security-report
	$(MAKE) snyk-ingestion-report
	$(MAKE) snyk-ingestion-base-slim-report
	$(MAKE) snyk-airflow-apis-report
	$(MAKE) snyk-server-report
	$(MAKE) snyk-ui-report
	$(MAKE)	export-snyk-pdf-report

.PHONY: export-snyk-pdf-report
export-snyk-pdf-report:  ## export json file from security-report/ to HTML
	@echo "Reading all results"
	npm install snyk-to-html -g
	ls security-report | xargs -I % snyk-to-html -i security-report/% -o security-report/%.html
	pip install pdfkit
	pip install PyPDF2
	python scripts/html_to_pdf.py

# Ingestion Operators
.PHONY: build-ingestion-base-local
build-ingestion-base-local:  ## Builds the ingestion DEV docker operator with the local ingestion files
	$(MAKE) install_dev generate
	docker build -f ingestion/operators/docker/Dockerfile.ci . -t openmetadata/ingestion-base:local

.PHONY: build-ingestion-base-slim-local
build-ingestion-base-local:  ## Builds the ingestion DEV docker operator with the local ingestion files
	$(MAKE) install_dev generate
	docker build -f ingestion/operators/docker/Dockerfile.ci . -t openmetadata/ingestion-base-slim:local --build-arg INGESTION_DEPENDENCY=slim

.PHONY: generate-schema-docs
generate-schema-docs:  ## Generates markdown files for documenting the JSON Schemas
	@echo "Generating Schema docs"
# Installing "0.4.0" version for simpler formatting
	python3 -m pip install "jsonschema2md==0.4.0"
	python3 scripts/generate_docs_schemas.py

#Upgrade release automation scripts below
.PHONY: update_all
update_all:  ## To update all the release related files run make update_all RELEASE_VERSION=2.2.2
	@echo "The release version is: $(RELEASE_VERSION)" ; \
	$(MAKE) update_maven ; \
	$(MAKE) update_pyproject_version ; \
	$(MAKE) update_dockerfile_version ; \
	$(MAKE) update_dockerfile_ri_version ; \
#remove comment and use the below section when want to use this sub module "update_all" independently to update github actions
#make update_all RELEASE_VERSION=2.2.2

.PHONY: update_maven
update_maven:  ## To update the common and pom.xml maven version
	@echo "Updating Maven projects to version $(RELEASE_VERSION)..."; \
	mvn versions:set -DnewVersion=$(RELEASE_VERSION)
#remove comment and use the below section when want to use this sub module "update_maven" independently to update github actions
#make update_maven RELEASE_VERSION=2.2.2


.PHONY: update_pyproject_version
update_pyproject_version:  ## To update the pyproject.toml files
	file_paths="ingestion/pyproject.toml \
				openmetadata-airflow-apis/pyproject.toml"; \
	echo "Updating pyproject.toml versions to $(RELEASE_VERSION)... "; \
	for file_path in $$file_paths; do \
	    python3 scripts/update_version.py update_pyproject_version -f $$file_path -v $(RELEASE_VERSION) ; \
	done
# Commented section for independent usage of the module update_pyproject_version independently to update github actions
#make update_pyproject_version RELEASE_VERSION=2.2.2

.PHONY: update_dockerfile_version
update_dockerfile_version:  ## To update the dockerfiles version
	@file_paths="docker/docker-compose-ingestion/docker-compose-ingestion.yml \
		     docker/docker-compose-openmetadata/docker-compose-openmetadata.yml \
		     docker/docker-compose-quickstart/docker-compose-postgres.yml \
		     docker/docker-compose-quickstart/docker-compose.yml"; \
	echo "Updating docker github action release version to $(RELEASE_VERSION)... "; \
	for file_path in $$file_paths; do \
	    python3 scripts/update_version.py update_docker_tag -f $$file_path -t $(RELEASE_VERSION) ; \
	done
#remove comment and use the below section when want to use this sub module "update_dockerfile_version" independently to update github actions
#make update_dockerfile_version RELEASE_VERSION=2.2.2

.PHONY: update_dockerfile_ri_version
update_dockerfile_ri_version:  ## To update the dockerfile RI_VERSION argument
	@file_paths="ingestion/Dockerfile \
	             ingestion/operators/docker/Dockerfile"; \
	echo "Updating ingestion dockerfile release version to $(PY_RELEASE_VERSION)... "; \
	for file_path in $$file_paths; do \
	    python3 scripts/update_version.py update_ri_version -f $$file_path -v $(RELEASE_VERSION) --with-python-version ; \
	done
	python3 scripts/update_version.py update_ri_version -f docker/docker-compose-quickstart/Dockerfile -v $(RELEASE_VERSION)
#remove comment and use the below section when want to use this sub module "update_dockerfile_ri_version" independently to update github actions
#make update_dockerfile_ri_version RELEASE_VERSION=2.2.2

#Upgrade release automation scripts above

.PHONY: update_typescript_files
update_typescript_files:
	@echo "Generating JSON to TS files"
	./openmetadata-ui/src/main/resources/ui/json2ts-generate-all.sh -l true
	@echo "Generating antlr typescript files"
	$(MAKE) js_antlr
