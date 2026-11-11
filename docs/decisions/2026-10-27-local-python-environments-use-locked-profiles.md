# Local Python commands use locked profiles and serialize model preparation

- **Status:** Accepted
- **Revisions:** v1 2026-10-27 (initial); v2 2026-10-28 (lock classification models)
- **Deciders:** Pablo Takara
- **Guard:** `ingestion/tests/unit/test_python_tooling.py`; DB2 connection tests
- **Related:** https://github.com/open-metadata/OpenMetadata/pull/36338

## Context

Local commands need repeatable dependencies without letting tool setup prune the application.
Generated models must exist before installation and cannot be rewritten during that installation.

## Decision

- Keep setuptools and shared dependency composition in `ingestion/setup.py`. Nox selects groups
  and extras from `pyproject.toml` and synchronizes with `uv.lock` using `--locked`.
- Bootstrap the uv version declared by `tool.uv.required-version` (currently 0.13.4).
  Application profiles synchronize exactly into `env/` or an explicitly selected environment;
  tool profiles synchronize additively into separate `ingestion/.nox/` environments.
- The test dependency group owns the four release-pinned classification model wheels, with
  SHA256 hashes. Static checks retain the full test profile. The existing provisioner validates
  installed versions, spaCy compatibility and model loading without fetching matching models.
- Public Nox generation and application setup share a checkout-local lock. It spans the freshness
  check, generation and application installation, including model provisioning. The generator
  script is the worker invoked under that lock; use Make/Nox for concurrent commands.
- Validate ANTLR against the existing Makefile pin before deleting outputs. Manifest version 2
  binds generated outputs to schema, grammar, lock, Make, Nox and generator-script hashes.
- Retain only the exact `sqlalchemy-ibmi==0.9.3` metadata correction needed by the existing
  SQLAlchemy 2 shim, preserving its other driver requirements and validating the dialect compatibility.

## Consequences

Changing application profiles removes unselected packages; tool commands preserve application
dependencies. Concurrent setup/generation waits for the checkout lock. Stale locks and mismatched
ANTLR tools fail rather than silently changing the dependency selection or stamping invalid output.
