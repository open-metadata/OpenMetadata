.PHONY: env38
PY_SOURCE ?= ingestion/src

env38:
#	virtualenv -p python3.8 env38
	python3.8 -m venv env38 
clean_env37:
	rm -rf env38

install:
	pip install ingestion/

install_test:
	pip install -r ingestion/requirements-test.txt

install_dev:
	pip install -r ingestion/requirements-dev.txt

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
	pytest -c setup.cfg --override-ini=testpaths=tests/integration/ometa

publish:
	make install_dev generate
	cd ingestion; \
	  python setup.py install sdist bdist_wheel; \
	  twine check dist/*; \
	  twine upload dist/*
