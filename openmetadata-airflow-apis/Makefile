.PHONY: test coverage

PYTHON ?= python3
UV = $(shell $(PYTHON) ../scripts/python_tools.py uv-path)

test coverage:
	"$(UV)" run --exact --locked --python "$(shell $(PYTHON) -c 'import sys; print(sys.executable)')" --group test nox -s tests -- $(COVERAGE_ARGS) $(ARGS)

coverage: COVERAGE_ARGS = --coverage
