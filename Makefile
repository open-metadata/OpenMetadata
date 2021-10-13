.PHONY: env38
PY_SOURCE ?= ingestion/src

env38:
#	virtualenv -p python3.8 env38
	python3.8 -m venv env38 
clean_env37:
	rm -rf env38

install_test:
	pip install ingestion/ -r ingestion/requirements-test.txt

lint:
	find $(PY_SOURCE) -path $(PY_SOURCE)/metadata/generated -prune -false -o -type f -name "*.py" | xargs pylint

black:
	black $(PY_SOURCE) --exclude $(PY_SOURCE)/metadata/generated

black_check:
	black --check --diff $(PY_SOURCE) --exclude $(PY_SOURCE)/metadata/generated
