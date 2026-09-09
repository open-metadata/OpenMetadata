.DEFAULT_GOAL := help
PY_SOURCE ?= ingestion/src
include ingestion/Makefile

.PHONY: help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":"}; {printf "\033[35m%-35s\033[0m %s\n", $$2, $$3}'

.PHONY: prerequisites
prerequisites:
	./scripts/check_prerequisites.sh

.PHONY: dev_setup
dev_setup:  ## One-call dev environment setup for macOS/Linux (pass flags via ARGS=...)
	./scripts/dev_setup.sh $(ARGS)

.PHONY: dev_check
dev_check:  ## Diagnose the dev environment without changing anything
	./scripts/dev_setup.sh --check

.PHONY: install_e2e_tests
install_e2e_tests:  ## Install the ingestion module with e2e test dependencies (playwright)
	uv pip install "ingestion[e2e_test]"
	playwright install chromium --with-deps

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
.PHONY: check-generated
check-generated:  ## Check whether ingestion generated files are current
	@python scripts/check_generated_models.py --check

.PHONY: generate
generate:  ## Generate the pydantic models from the JSON Schemas to the ingestion module
	python scripts/generate_ingestion_models.py

## Reference docs generation (deterministic; CI fails if the committed output drifts)
.PHONY: generate-entity-index
generate-entity-index:  ## Generate docs/generated/entity-index.md from schemas + resources
	python3 scripts/generate_entity_index.py

.PHONY: generate-api-reference
generate-api-reference:  ## Generate docs/generated/api-reference.md from JAX-RS resources
	python3 scripts/generate_api_reference.py

.PHONY: generate-reference-docs
generate-reference-docs: generate-entity-index generate-api-reference  ## Regenerate all docs/generated/*.md

.PHONY: harness-check
harness-check:  ## Warn on harness decay (dead refs, doc sizes, rule globs, generated-doc freshness)
	python3 scripts/harness/check_harness.py

.PHONY: install_antlr_cli
ANTLR_VERSION := 4.9.2
# Dots escaped so the banner match below is a real version match, not a
# regex wildcard, and so 4.9.20 cannot satisfy a 4.9.2 check.
ANTLR_VERSION_RE := $(subst .,\.,$(ANTLR_VERSION))
# install_antlr_cli resolves the CLI in three steps, cheapest first:
#
#   1. Already on PATH at the pinned version -> nothing to do.
#   2. Distro package, when apt offers exactly $(ANTLR_VERSION). Ubuntu noble and
#      later ship 4.9.2, matching the pinned antlr4-python3-runtime and the JS
#      antlr4 runtimes, so CI never touches a public artifact host - those
#      rate-limit our shared CI egress IP and have broken the build repeatedly.
#   3. Pinned, checksum-verified download (macOS, non-Debian images, or a distro
#      carrying a different ANTLR such as jammy's 4.7.2).
#
# The checksum is what makes step 3 trustworthy; the archive check next to it is a
# second opinion, so it reads the archive with whichever tool the host has rather
# than insisting on one. Requiring a JDK tool to install a CLI that only needs a
# JRE to run breaks slim runtime images (e.g. ingestion-base ships
# default-jre-headless, which has java but no jar) on a download that already
# verified clean. A tool that is present and rejects the archive still fails the
# build; only the case where no reader exists falls through to the checksum alone,
# and such a host has no java either, so it could not run the CLI regardless.
#
# The version match in step 2 is exact. A distro shipping a different ANTLR falls
# through to the download rather than silently generating parsers that the pinned
# runtimes will reject.
#
# For step 3, override ANTLR_MAVEN_BASE to pull from an internal Maven mirror
# instead of Central. The default primary is Google's Central mirror, which is
# CDN-backed and not subject to repo1's per-IP 429 throttling that breaks
# multi-arch Docker publishes; repo1 stays as the fallback if the mirror is
# unreachable. The pinned SHA-256 below verifies whatever is fetched, so the
# source is swappable without lowering trust.
ANTLR_MAVEN_BASE ?= https://maven-central.storage-download.googleapis.com/maven2
ANTLR_MAVEN_FALLBACK_BASE ?= https://repo1.maven.org/maven2
ANTLR_COMPLETE_JAR_PATH := org/antlr/antlr4/$(ANTLR_VERSION)/antlr4-$(ANTLR_VERSION)-complete.jar
ANTLR_COMPLETE_JAR_URL := $(ANTLR_MAVEN_BASE)/$(ANTLR_COMPLETE_JAR_PATH)
ANTLR_COMPLETE_JAR_FALLBACK_URL := $(ANTLR_MAVEN_FALLBACK_BASE)/$(ANTLR_COMPLETE_JAR_PATH)
ANTLR_COMPLETE_JAR_SHA256 := bb117b1476691dc2915a318efd36f8957c0ad93447fb1dac01107eb15fe137cd
ANTLR_INSTALL_DIR ?= /usr/local/bin

install_antlr_cli:  ## Install antlr CLI locally
	@set -eu; \
	if command -v antlr4 > /dev/null 2>&1 \
		&& antlr4 2>&1 | grep -Eq 'Version $(ANTLR_VERSION_RE)([^0-9]|$$)'; then \
		echo "ANTLR $(ANTLR_VERSION) already available at $$(command -v antlr4); nothing to do."; \
		exit 0; \
	fi; \
	if command -v apt-get > /dev/null 2>&1; then \
		candidate=$$(apt-cache policy antlr4 2>/dev/null | awk '/Candidate:/ {print $$2}'); \
		if [ -z "$$candidate" ] || [ "$$candidate" = "(none)" ]; then \
			apt-get update -qq > /dev/null 2>&1 || true; \
			candidate=$$(apt-cache policy antlr4 2>/dev/null | awk '/Candidate:/ {print $$2}'); \
		fi; \
		case "$$candidate" in \
			$(ANTLR_VERSION)|$(ANTLR_VERSION)[-+~]*) \
				if apt-get install -y -qq antlr4 > /dev/null 2>&1; then \
					if command -v antlr4 > /dev/null 2>&1 \
						&& antlr4 2>&1 | grep -Eq 'Version $(ANTLR_VERSION_RE)([^0-9]|$$)'; then \
						echo "Installed ANTLR $$candidate from the distro archive."; \
						exit 0; \
					fi; \
					echo "Distro package installed, but antlr4 on PATH resolves to $$(command -v antlr4 2>/dev/null || echo none) which is not $(ANTLR_VERSION); falling back to pinned download." >&2; \
				else \
					echo "apt-get install antlr4 failed; falling back to pinned download." >&2; \
				fi; \
				;; \
			*) \
				echo "Distro ANTLR candidate '$$candidate' is not $(ANTLR_VERSION); using pinned download." >&2; \
				;; \
		esac; \
	fi; \
	jar_file=$$(mktemp); \
	cli_file=$$(mktemp "$(ANTLR_INSTALL_DIR)/.antlr4.XXXXXX"); \
	trap 'rm -f "$$jar_file" "$$cli_file"' EXIT; \
	if command -v shasum > /dev/null 2>&1; then \
		sha_check="shasum -a 256 --check"; \
	elif command -v sha256sum > /dev/null 2>&1; then \
		sha_check="sha256sum --check"; \
	else \
		echo "Neither shasum nor sha256sum is available; cannot verify the ANTLR download." >&2; \
		exit 1; \
	fi; \
	urls=$$(printf '%s\n%s\n' "$(ANTLR_COMPLETE_JAR_URL)" "$(ANTLR_COMPLETE_JAR_FALLBACK_URL)" | awk 'NF && !seen[$$0]++'); \
	attempt=1; \
	while :; do \
		for url in $$urls; do \
			if curl --fail --location --silent --show-error \
				--retry 3 --retry-all-errors --retry-delay 2 --retry-max-time 120 \
				--connect-timeout 15 --max-time 60 \
				--output "$$jar_file" "$$url" \
				&& printf '%s  %s\n' "$(ANTLR_COMPLETE_JAR_SHA256)" "$$jar_file" | $$sha_check \
				&& { if command -v jar > /dev/null 2>&1; then \
					jar tf "$$jar_file" > /dev/null; \
				elif command -v unzip > /dev/null 2>&1; then \
					unzip -tqq "$$jar_file" > /dev/null; \
				else :; fi; }; then \
				break 2; \
			fi; \
			echo "ANTLR $(ANTLR_VERSION) download failed from $$url (attempt $$attempt)" >&2; \
		done; \
		if [ "$$attempt" -ge 3 ]; then \
			echo "Failed to download a valid ANTLR $(ANTLR_VERSION) CLI after $$attempt attempts" >&2; \
			exit 1; \
		fi; \
		attempt=$$((attempt + 1)); \
		sleep 2; \
	done; \
	printf '%s\n' '#!/usr/bin/java -jar' > "$$cli_file"; \
	cat "$$jar_file" >> "$$cli_file"; \
	chmod 755 "$$cli_file"; \
	mv "$$cli_file" "$(ANTLR_INSTALL_DIR)/antlr4"

## SNYK
SNYK_ARGS := --severity-threshold=high

# Drop pip's build/lib tree before scanning so `snyk code test` does not
# double-report findings (once under src/, once under build/lib/). Same
# applies to snyk-airflow-apis-report below.
.PHONY: snyk-ingestion-report
snyk-ingestion-report:  ## Uses Snyk CLI to validate the ingestion code and container. Don't stop the execution
	@echo "Validating Ingestion container..."
	docker build -t openmetadata-ingestion:scan -f ingestion/Dockerfile.ci .
	snyk container test openmetadata-ingestion:scan --file=ingestion/Dockerfile.ci $(SNYK_ARGS) --json > security-report/ingestion-docker-scan.json | true;
	@echo "Validating ALL ingestion dependencies. Make sure the venv is activated."
	cd ingestion; \
		pip freeze > scan-requirements.txt; \
		rm -rf build; \
		snyk test --file=scan-requirements.txt --package-manager=pip --command=python3 $(SNYK_ARGS) --json > ../security-report/ingestion-dep-scan.json | true; \
		snyk code test $(SNYK_ARGS) --json > ../security-report/ingestion-code-scan.json | true;

.PHONY: snyk-airflow-apis-report
snyk-airflow-apis-report:  ## Uses Snyk CLI to validate the airflow apis code. Don't stop the execution
	@echo "Validating airflow dependencies. Make sure the venv is activated."
	cd openmetadata-airflow-apis; \
		rm -rf build; \
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

.PHONY: docker-base-image-cve-test
docker-base-image-cve-test:  ## Assert the ingestion-base image is free of the five Debian 12 OS CVEs and its driver stack still loads. Usage: make docker-base-image-cve-test IMAGE=<tag>
	./ingestion/tests/docker/base_image_cve_test.sh $(IMAGE)

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
	uv pip install pdfkit PyPDF2
	python scripts/html_to_pdf.py

# Ingestion Operators
.PHONY: build-ingestion-base-local
build-ingestion-base-local:  ## Builds the ingestion DEV docker operator with the local ingestion files
	$(MAKE) install_dev generate
	docker build -f ingestion/operators/docker/Dockerfile.ci . -t openmetadata/ingestion-base:local

.PHONY: build-ingestion-slim-local
build-ingestion-slim-local:  ## Builds the SLIM ingestion DEV docker operator with the local ingestion files
	$(MAKE) install_dev generate
	docker build -f ingestion/operators/docker/Dockerfile.ci . -t openmetadata/ingestion-base-slim:local --build-arg INGESTION_DEPENDENCY=slim

#Upgrade release automation scripts below
.PHONY: update_all
update_all:  ## To update all the release related files run make update_all RELEASE_VERSION=2.2.2
	@echo "The release version is: $(RELEASE_VERSION)" ; \
	$(MAKE) update_maven ; \
	$(MAKE) update_openapi_version ; \
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

.PHONY: update_openapi_version
update_openapi_version:  ## To update the OpenAPI version in OpenMetadataApplication.java
	@echo "Updating OpenAPI version to $(RELEASE_VERSION)..."; \
	python3 scripts/update_version.py update_openapi_version -v $(RELEASE_VERSION)
#make update_openapi_version RELEASE_VERSION=2.2.2

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

.PHONY: update_typescript_types
update_typescript_types:
	@echo "Generating JSON to TS files"
	./openmetadata-ui/src/main/resources/ui/json2ts-generate-all.sh -l true
	@echo "Generating antlr typescript files"
	$(MAKE) js_antlr

# Fix license header in all UI files.
.PHONY: license-header-fix
license-header-fix:
	cd openmetadata-ui/src/main/resources/ui && yarn install --frozen-lockfile && yarn license-header-fix

# Run TypeScript type-checking for src files (does not auto-fix errors).
.PHONY: tsc-src-fix
tsc-src-fix:
	cd openmetadata-ui/src/main/resources/ui && yarn install --frozen-lockfile && yarn tsc:check

# Run TypeScript type-checking for Playwright files (does not auto-fix errors).
.PHONY: tsc-playwright-fix
tsc-playwright-fix:
	cd openmetadata-ui/src/main/resources/ui && yarn install --frozen-lockfile && yarn tsc:playwright

# Sync all i18n files to have the same keys and order. This doesn't modify the translation.
# Just makes sure all files have the same keys in the same order to avoid conflicts and make it easier to maintain.
.PHONY: i18n-sync-fix
i18n-sync-fix:
	cd openmetadata-ui/src/main/resources/ui && yarn install --frozen-lockfile && yarn i18n

# Generate the docs markdown file for all applications.
.PHONY: generate-app-docs
generate-app-docs:
	cd openmetadata-ui/src/main/resources/ui && yarn install --frozen-lockfile && yarn generate:app-docs

# Fix all linting and formatting errors in src folder.
.PHONY: ui-checkstyle-src
ui-checkstyle-src:
	cd openmetadata-ui/src/main/resources/ui && yarn install --frozen-lockfile && yarn ui-checkstyle

# Fix all linting and formatting errors in playwright tests.
.PHONY: ui-checkstyle-playwright
ui-checkstyle-playwright:
	cd openmetadata-ui/src/main/resources/ui && yarn install --frozen-lockfile && yarn ui-checkstyle:playwright

# Fix all linting and formatting errors in core components.
.PHONY: ui-checkstyle-core-components
ui-checkstyle-core-components:
	cd openmetadata-ui-core-components/src/main/resources/ui && yarn install --frozen-lockfile && yarn lint:fix && yarn pretty

# Fix linting and formatting errors in changed files in src folder
# Changed files are detected based on the current branch against main branch.
# So make sure to run this after rebasing to main to get the correct list of changed files.
.PHONY: ui-checkstyle-src-changed
ui-checkstyle-src-changed:
	cd openmetadata-ui/src/main/resources/ui && yarn install --frozen-lockfile && yarn ui-checkstyle:changed

# Fix linting and formatting errors in changed playwright test files
# Changed files are detected based on the current branch against main branch.
# So make sure to run this after rebasing to main to get the correct list of changed files.
.PHONY: ui-checkstyle-playwright-changed
ui-checkstyle-playwright-changed:
	cd openmetadata-ui/src/main/resources/ui && yarn install --frozen-lockfile && yarn ui-checkstyle:playwright:changed

# Fix linting and formatting errors in changed core components files
# Changed files are detected based on the current branch against main branch.
# So make sure to run this after rebasing to main to get the correct list of changed files.
.PHONY: ui-checkstyle-core-components-changed
ui-checkstyle-core-components-changed:
	cd openmetadata-ui-core-components/src/main/resources/ui && yarn install --frozen-lockfile && yarn ui-checkstyle:changed

# Run all full UI checkstyle operations with one command.
.PHONY: ui-checkstyle-all
ui-checkstyle-all:
	cd openmetadata-ui/src/main/resources/ui && yarn install --frozen-lockfile && yarn ui-checkstyle && yarn ui-checkstyle:playwright
	cd openmetadata-ui-core-components/src/main/resources/ui && yarn install --frozen-lockfile && yarn lint:fix && yarn pretty

# Run all changed-file UI checkstyle operations with one command.
.PHONY: ui-checkstyle-changed
ui-checkstyle-changed:
	cd openmetadata-ui/src/main/resources/ui && yarn install --frozen-lockfile && yarn ui-checkstyle:changed && yarn ui-checkstyle:playwright:changed
	cd openmetadata-ui-core-components/src/main/resources/ui && yarn install --frozen-lockfile && yarn ui-checkstyle:changed
