.PHONY: test coverage

PYTHON ?= python3
UV = $(shell $(PYTHON) ../scripts/python_tools.py uv-path)

test:
	"$(UV)" run --exact --locked --python "$(shell $(PYTHON) -c 'import sys; print(sys.executable)')" --group test nox -s tests -- $(ARGS)

coverage:
	$(MAKE) test ARGS="--coverage $(ARGS)"
