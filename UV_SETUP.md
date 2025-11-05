# UV Setup Instructions

This document provides instructions for transitioning the OpenMetadata project to use UV instead of pip for dependency management.

## Current State

The project currently uses pip-based dependency management but includes UV support with the following existing targets in `ingestion/Makefile`:

- `uv_install_dev_env` - Install all dependencies for development using uv (recommended)
- `uv_setup` - Create .venv using uv and sync all development dependencies
- `uv_sync` - Sync dependencies using uv (uses uv.lock if available)
- `uv_sync_all` - Sync all dependencies including all extras using uv
- `uv_lock` - Update uv.lock file with current dependencies
- `uv_sync_frozen` - Sync dependencies using frozen lock file (CI/CD)

## Benefits of UV

- Faster dependency resolution and installation
- Better lock file management with uv.lock
- More reliable reproducible builds
- Improved compatibility with modern Python packaging standards

## Migration Steps for Generate Recipe

When ready to migrate the `generate` recipe to use UV:

### 1. Update the generate recipe in `/Makefile`

Replace:
```makefile
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
```

With:
```makefile
## Ingestion models generation
.PHONY: generate
generate:  ## Generate the pydantic models from the JSON Schemas to the ingestion module
	@echo "Running Datamodel Code Generator"
	@echo "Make sure to first run uv_install_dev_env to have datamodel-code-generator available"
	rm -rf ingestion/src/metadata/generated
	mkdir -p ingestion/src/metadata/generated
	cd ingestion && uv run python ../scripts/datamodel_generation.py
	$(MAKE) py_antlr js_antlr
	$(MAKE) uv_install
```

### 2. Add uv_install target to `/ingestion/Makefile`

Add the following target:
```makefile
.PHONY: uv_install
uv_install:  ## Install the ingestion module using uv
	uv pip install $(INGESTION_DIR)/
```

### 3. Prerequisites

Before running the generate recipe with UV:

1. Install UV if not already available:
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. Set up the development environment:
   ```bash
   make uv_install_dev_env
   ```

3. Verify datamodel-code-generator is available:
   ```bash
   cd ingestion
   uv run python -c "import datamodel_code_generator; print('Available')"
   ```

## Verification

The `datamodel-code-generator==0.25.6` package is included in the `dev` extras in `setup.py`, so it will be available when using `uv_install_dev_env`.

## Rollback

If issues arise, the original pip-based approach can be restored by reverting the changes and using the original targets:
- `install_dev` instead of `uv_install_dev_env`
- `install` instead of `uv_install`
- Direct `python` execution instead of `uv run`