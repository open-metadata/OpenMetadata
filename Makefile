.PHONY: env38
PY_SOURCE ?= ingestion/src

env38:
#	virtualenv -p python3.8 env38
	python3.8 -m venv env38 
clean_env37:
	rm -rf env38

install:
	python3 -m pip install ingestion/

install_test:
	python3 -m pip install -r ingestion/requirements-test.txt

install_dev:
	python3 -m pip install -r ingestion/requirements-dev.txt

precommit_install:
	@echo "Installing pre-commit hooks"
	@echo "Make sure to first run `make install_test`"
	pre-commit install --config ingestion/.pre-commit-config.yaml

isort:
	isort $(PY_SOURCE) --skip $(PY_SOURCE)/metadata/generated --profile black --multi-line 3

lint:
	find $(PY_SOURCE) -path $(PY_SOURCE)/metadata/generated -prune -false -o -type f -name "*.py" | xargs pylint

black:
	black $(PY_SOURCE) --exclude $(PY_SOURCE)/metadata/generated

black_check:
	black --check --diff $(PY_SOURCE) --exclude $(PY_SOURCE)/metadata/generated

generate:
	@echo "Running Datamodel Code Generator"
	@echo "Make sure to first run `make install_dev`"
	datamodel-codegen  --input catalog-rest-service/src/main/resources/json  --input-file-type jsonschema --output ingestion/src/metadata/generated

run_ometa_integration_tests:
	cd ingestion; \
	pytest -c setup.cfg --override-ini=testpaths="tests/integration/ometa tests/unit/stage_test.py"

publish:
	make install_dev generate
	cd ingestion; \
	  python setup.py install sdist bdist_wheel; \
	  twine check dist/*; \
	  twine upload dist/*

build_docker_base:
	make install_dev generate
	docker build -f ingestion/connectors/Dockerfile-base ingestion/ -t openmetadata/ingestion-connector-base

build_docker_connectors:
	@echo "Building Docker connectors. Make sure to run build_docker_base first"
	python ingestion/connectors/docker-cli.py build

push_docker_connectors:
	@echo "Pushing Docker connectors. Make sure to run build_docker_connectors first"
	python ingestion/connectors/docker-cli.py push

yarn_install_cache:
	cd openmetadata-ui/src/main/resources/ui && yarn install --frozen-lockfile

yarn_start_dev_ui:
	cd openmetadata-ui/src/main/resources/ui && yarn start
