# Adding a new connector

`mysql/` is the reference. Mirror its file layout.

## Scaffold

```
<connector>/
  __init__.py            # empty
  baseline.py            # SQLAlchemy MetaData + seeds + views + SPs (declarative only)
  connector.py           # service_name() + build_<connector>_config()
  enforcer.py            # SqlBaselineEnforcer subclass
  expected.py            # TYPE_MAP extension + <connector>_expected() helper
  conftest.py            # <connector>_container fixture + thin wiring
  test_<connector>.py    # tests
```

## Per file

1. **`baseline.py`** — declare schema with SQLAlchemy Core. Reuse `core/source/common_baseline.py` for portable tables (customers, transactions). Put dialect-specific types on a wide `all_types` table keyed on `BigInteger id`.
2. **`enforcer.py`** — subclass `SqlBaselineEnforcer`. Usually only override `_stored_procedure_query_sql` (returns `(schema, name)` rows). Other overrides are rare; see `mysql/enforcer.py`.
3. **`expected.py`** — extend `CORE_TYPE_MAP` with dialect types. Export `<connector>_expected(service_name, tables=None)` calling `derive_expected_service(...)`.
4. **`connector.py`** — `<connector>_service_name(session_uuid, variant="")` and `build_<connector>_config(service_name, server)`. The config emits `${E2E_<CONNECTOR>_*}` refs — never embed raw secrets.
5. **`conftest.py`** — session-scoped `<connector>_container` boots the source via testcontainers, creates the scoped ingest user with OM-doc-minimum GRANTs, and populates `E2E_<CONNECTOR>_*` env vars (so `Env(key).ref()` in `connector.py` resolves). Then the thin wiring fixtures: session-scoped `_admin_engine` (admin engine, disposed on teardown) and `_policy` (`EnforcementPolicy` over the enforcer), plus `_source_ready`, `_service`, `_cfg`, `_expected_factory`, `_metadata_ingested`. Mirror `mysql/conftest.py`.
6. **`test_<connector>.py`** — one `test_vanilla_ingest_structural`, one test per pipeline you ship (profiler / lineage / classification), and a parametrized filter matrix using `COMMON_FILTER_SCENARIOS` + a per-connector `_EXPECTED_TABLES_BY_VARIANT` dict. Mirror `mysql/test_mysql.py`.

## Validate

```bash
docker compose -f docker/development/docker-compose.yml up -d
pytest tests/cli_e2e_v2/<connector> -v
```

Failures: see `README.md`.
