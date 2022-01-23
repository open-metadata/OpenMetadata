.PHONY: env38
PY_SOURCE ?= ingestion/src

env38:
#	virtualenv -p python3.8 env38
	python3.8 -m venv env38 
clean_env37:
	rm -rf env38

install:
	python -m pip install ingestion/

install_test:
	python -m pip install "ingestion[test]/"

install_dev:
	python -m pip install "ingestion[dev]/"

precommit_install:
	@echo "Installing pre-commit hooks"
	@echo "Make sure to first run `make install_test`"
	pre-commit install

## Checkstyle
isort:
	isort $(PY_SOURCE) --skip $(PY_SOURCE)/metadata/generated --profile black --multi-line 3

lint:
	find $(PY_SOURCE) -path $(PY_SOURCE)/metadata/generated -prune -false -o -type f -name "*.py" | xargs pylint

black:
	black $(PY_SOURCE) --exclude $(PY_SOURCE)/metadata/generated

black_check:
	black --check --diff $(PY_SOURCE) --exclude $(PY_SOURCE)/metadata/generated

## Ingestion models generation
generate:
	@echo "Running Datamodel Code Generator"
	@echo "Make sure to first run the install_dev recipe"
	datamodel-codegen --input catalog-rest-service/src/main/resources/json --input-file-type jsonschema --output ingestion/src/metadata/generated
	$(MAKE) install

## Ingestion tests & QA
run_ometa_integration_tests:
	coverage run -m pytest -c ingestion/setup.cfg --doctest-modules --junitxml=ingestion/junit/test-results-integration.xml --override-ini=testpaths="ingestion/tests/integration/ometa ingestion/tests/integration/stage"

unit_ingestion:
	coverage run -m pytest -c ingestion/setup.cfg -s --doctest-modules --junitxml=ingestion/junit/test-results-unit.xml --override-ini=testpaths="ingestion/tests/unit"

coverage:
	coverage erase
	$(MAKE) unit_ingestion
	$(MAKE) run_ometa_integration_tests
	coverage xml -i -o ingestion/coverage.xml

sonar_ingestion:
	docker run \
		--rm \
		-e SONAR_HOST_URL="https://sonarcloud.io" \
		-e SONAR_LOGIN=$(token) \
		-v ${PWD}:/usr/src \
		sonarsource/sonar-scanner-cli \
		-Dproject.settings=ingestion/sonar-project.properties

## Ingestion publish
publish:
	$(MAKE) install_dev generate
	cd ingestion; \
	  python setup.py install sdist bdist_wheel; \
	  twine check dist/*; \
	  twine upload dist/*

## Docker operators
build_docker_base:
	$(MAKE) install_dev generate
	docker build -f ingestion/connectors/Dockerfile-base ingestion/ -t openmetadata/ingestion-connector-base

build_docker_connectors:
	@echo "Building Docker connectors. Make sure to run build_docker_base first"
	python ingestion/connectors/docker-cli.py build

push_docker_connectors:
	@echo "Pushing Docker connectors. Make sure to run build_docker_connectors first"
	python ingestion/connectors/docker-cli.py push

## Yarn
yarn_install_cache:
	cd openmetadata-ui/src/main/resources/ui && yarn install --frozen-lockfile

yarn_start_dev_ui:
	cd openmetadata-ui/src/main/resources/ui && yarn start

## Ingestion Core
core_install_dev:
	cd ingestion-core; \
		rm -rf venv; \
		python -m virtualenv venv; \
		. venv/bin/activate; \
		python -m pip install ".[dev]"

core_clean:
	rm -rf ingestion-core/src/metadata/generated
	rm -rf ingestion-core/build
	rm -rf ingestion-core/dist

core_generate:
	$(MAKE) core_install_dev
	mkdir -p ingestion-core/src/metadata/generated
	. ingestion-core/venv/bin/activate
	datamodel-codegen --input catalog-rest-service/src/main/resources/json  --input-file-type jsonschema --output ingestion-core/src/metadata/generated

core_bump_version_dev:
	$(MAKE) core_install_dev
	cd ingestion-core; \
		. venv/bin/activate; \
		python -m incremental.update metadata --dev

core_publish:
	$(MAKE) core_clean core_generate
	cd ingestion-core; \
		. venv/bin/activate; \
		python setup.py install sdist bdist_wheel; \
		twine check dist/*; \
		twine upload -r testpypi dist/*
