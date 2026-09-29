---
description: Python ingestion — pytest style, connector-specific-file rule, model_str(), formatting
paths: "ingestion/src/**/*.py"
---

# Python ingestion conventions

Applies to `ingestion/src/**/*.py`. For building/reviewing a connector, load the `connector-standards`
skill and use `connector-building` / `connector-review`. Compliant reference:
`ingestion/src/metadata/ingestion/source/database/redshift/connection.py`.

## Test style

- **Use pytest, not unittest** — plain `assert` statements, pytest fixtures for setup (not
  `setUp`/`tearDown`). Use `unittest.mock` (MagicMock, patch) for mocking. Test classes do **not**
  inherit `TestCase`; use plain classes prefixed `Test`.
  - `assert x == y` (not `self.assertEqual`), `assert x is None` (not `assertIsNone`),
    `assert "text" in string` (not `assertIn`).

## Connector guidelines

- **Keep connector-specific logic in connector-specific files**, not in generic/shared files like
  `builders.py`. E.g. Redshift IAM auth belongs in
  `ingestion/src/metadata/ingestion/source/database/redshift/connection.py`, not in
  `ingestion/src/metadata/ingestion/connections/builders.py`. This keeps generic utilities from
  accreting connector edge cases.
- **Use `model_str()` for Pydantic RootModel → string** — schema types like `ColumnName`, `EntityName`,
  `FullyQualifiedEntityName`, `UUID` are `RootModel[str]` subclasses where `str()` yields
  `"root='value'"`, not the raw value. Use `model_str()` from `metadata.ingestion.ometa.utils` instead
  of manual `hasattr(x, "root")` / `str(x.root)`.

## Formatting & checks (from `ingestion/`, venv active)

```bash
make py_format          # ruff lint-fix + format (this is ruff, not black/isort/pycln)
make py_format_check    # verify lint + format (matches CI)
make static-checks      # basedpyright type checking
make unit_ingestion_dev_env   # unit tests
```
