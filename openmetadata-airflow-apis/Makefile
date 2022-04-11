.DEFAULT_GOAL := help

.PHONY: help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[35m%-30s\033[0m %s\n", $$1, $$2}'

.PHONY: install
install:  ## Install the openmetadata module to the current environment
	python -m pip install .

.PHONY: install_dev
install_dev:  ## Install the openmetadata module with dev dependencies
	python -m pip install ".[dev]"

.PHONY: lint
lint: ## Run pylint on the Python sources to analyze the codebase
	find $(PY_SOURCE) -path $(PY_SOURCE)/metadata/generated -prune -false -o -type f -name "*.py" | xargs pylint --ignore-paths=$(PY_SOURCE)/metadata_server/

.PHONY: py_format
py_format:  ## Run black and isort to format the Python codebase
	pycln src/ --extend-exclude src/openmetadata/generated
	isort src/ --skip src/openmetadata/generated --profile black --multi-line 3
	black src/ --extend-exclude src/openmetadata/generated

.PHONY: py_format_check
py_format_check:  ## Check if Python sources are correctly formatted
	pycln src/ --diff --extend-exclude src/openmetadata/generated
	isort --check-only src/ --skip src/openmetadata/generated --profile black --multi-line 3
	black --check --diff src/ --extend-exclude src/openmetadata/generated
