# Adding a new connector to CLI E2E v2

This walk-through takes you from zero to a working connector test module. MySQL is the reference implementation — skim `mysql/` after reading this.

## TL;DR

1. Create seven files under `<connector>/` (see scaffolding below).
2. Declare the source baseline (tables, seeds, views, stored procedures) in `baseline.py` using SQLAlchemy Core.
3. Provide a dialect-specific enforcer subclass in `enforcer.py` (stored-procedure listing + DDL).
4. Extend the type map in `expected.py` with dialect-specific SQLAlchemy types.
5. Wire fixtures in `conftest.py` using the core helpers.
6. Write tests in `test_<connector>.py` — the fluent catalog in `core/fluent/__init__.py` covers most assertions.

## Prerequisites

- A running OpenMetadata instance (`docker/development/docker-compose.yml`).
- A running instance of your connector's data source.
- Two credential pairs for that source:
  - **admin** — needs `CREATE SCHEMA`, `CREATE TABLE`, `INSERT`, `SELECT`, `CREATE PROCEDURE` on the baseline schema. Used by the enforcer to bring the source into shape.
  - **ingest** — the scoped service account OM will use. Typically gets `SELECT`, `EXECUTE`, dialect-specific metadata-read privileges on the baseline schema. Used by the CLI subprocess.

See the memory note `feedback-e2e-admin-vs-ingest-creds.md` for why these must be separate.

## Env var convention

All per-connector env vars use the `E2E_<CONNECTOR>_<FIELD>` prefix:

| Name | Required | Purpose |
|---|---|---|
| `E2E_<CONN>_USER` | yes | ingest username |
| `E2E_<CONN>_PASSWORD` | yes | ingest password |
| `E2E_<CONN>_HOST_PORT` | yes | `host:port` for the DSN |
| `E2E_<CONN>_DATABASE` | no | default database / catalog if the connector needs one |
| `E2E_<CONN>_ADMIN_USER` | optional (has default) | baseline-enforcer username |
| `E2E_<CONN>_ADMIN_PASSWORD` | optional (has default) | baseline-enforcer password |

The admin defaults should reflect the matching `docker-compose.yml` root credentials so local runs need no env plumbing.

## Seven-file scaffold

```
<connector>/
  __init__.py           # empty package marker
  baseline.py           # SQLAlchemy MetaData + seeds + views + SPs + policy factory
  connector.py          # service-name helper + WorkflowConfig factory
  enforcer.py           # dialect DDL specifics (SP DDL, view DDL if non-standard)
  expected.py           # TYPE_MAP extension + expected() helper
  conftest.py           # thin fixtures wiring core helpers
  test_<connector>.py   # test module
```

### `baseline.py`

Declares the source schema via SQLAlchemy Core. Portable tables (customers, transactions) come from `core/source/common_baseline.py` — extend with dialect-specific tables as needed. Carry dialect-specific INSERT templates on each `TableSeed` (e.g. `ON DUPLICATE KEY UPDATE` for MySQL, `ON CONFLICT DO UPDATE` for Postgres) so seeds are idempotent.

**Convention for dialect-specific type coverage**: if your connector exercises native types not present in SQLAlchemy core (TINYINT/MEDIUMINT/ENUM on MySQL, ARRAY/JSONB/INET on Postgres, …), declare them on a single wide table named `all_types` with a `BigInteger` primary key column `id`. Three seed rows are enough — tests assert OM's type mapping, not row content. Mirroring the table name + PK shape across connectors keeps cross-dialect tests readable.

Expose a cached `get_policy() -> EnforcementPolicy` (use `@lru_cache(maxsize=1)` so the SQLAlchemy engine is built once per session). For local Docker, policy mode is `"apply"`; for shared cloud sources, `"check_only"`.

### `connector.py`

Two functions: `<connector>_service_name(session_uuid, variant="") -> str` and `build_<connector>_config(service_name, server) -> WorkflowConfig`. The config builder emits `${E2E_...}` refs in the rendered YAML — never embed raw secrets.

### `enforcer.py`

Subclass `SqlBaselineEnforcer`. You usually only override:
- `_stored_procedure_query_sql` — raw SQL that returns `(schema, name)` rows. Binds a `:schemas` IN-list.
- `_apply_stored_procedure(conn, sp)` — dialect-specific procedure DDL (e.g. MySQL needs DROP + CREATE because there's no `CREATE OR REPLACE PROCEDURE`).
- `_apply_view(conn, view)` — override only if `view.definition_sql` isn't directly executable in the dialect.

### `expected.py`

Extend `CORE_TYPE_MAP` with dialect types that either (a) don't exist in core, (b) want a more-specific OM DataType than their generic parent would yield, or (c) have SQLAlchemy bases that MRO-skip past the generic in core (e.g. MySQL's `_StringType`). Provide a `<connector>_expected(service_name, tables=None)` helper that calls `derive_expected_service(...)` and lets filter tests project to a subset.

### `conftest.py`

Thin — use `core/fixtures.py` helpers:

```python
@pytest.fixture(scope="session")
def <conn>_source_ready() -> None:
    run_source_baseline(get_policy, <CONN>_BASELINE, connector_name="<conn>")

@pytest.fixture(scope="session")
def <conn>_service(session_uuid: str) -> str:
    return <conn>_service_name(session_uuid)

@pytest.fixture(scope="module")
def <conn>_cfg(om_server_config, <conn>_service, <conn>_source_ready) -> WorkflowConfig:
    return build_<conn>_config(<conn>_service, om_server_config)

@pytest.fixture(scope="module")
def <conn>_expected_factory(<conn>_service):
    def _factory(*, tables=None):
        return <conn>_expected(<conn>_service, tables=tables)
    return _factory

@pytest.fixture(scope="module")
def <conn>_metadata_ingested(tmp_path_factory, <conn>_cfg, <conn>_service, registered_services) -> None:
    metadata_ingest_once(
        tmp_path_factory, <conn>_cfg, registered_services,
        service_name=<conn>_service,
        pipeline_options=MetadataPipeline(includeStoredProcedures=True, includeDDL=True),
        filter_kwargs={"schemas_include": ["e2e"]},
        label="<conn>",
    )
```

### `test_<connector>.py`

- Structural: one `test_vanilla_ingest_structural` using `assert_service_matches(<conn>_expected_factory(), om_client)`.
- Per-pipeline: one test per pipeline you ship (profiler, lineage, classification, etc.).
- Filter matrix: parametrize over `COMMON_FILTER_SCENARIOS` and supply a per-connector `_EXPECTED_TABLES_BY_VARIANT` dict.

See `mysql/test_mysql.py` for the canonical layout — file structure and comment anchors are worth mirroring.

## Validating

1. Start the OM stack: `docker compose -f docker/development/docker-compose.yml up -d`.
2. Start / verify your source.
3. Export the env vars above.
4. `pytest tests/cli_e2e_v2/<connector> -v`.

If anything fails, see `README.md` for debug-path guidance.

## Common sources of trouble

- **Missing ingest-user privileges**: test fails with `permission denied` or `access denied`. Grant the missing privilege directly on the source; do NOT weaken the baseline enforcer.
- **FK constraints don't appear in OM**: see memory note `project-om-buffered-sink-post-process-bug.md`. The framework already forces `bulk_sink_batch_size: 1` in `ServerConfig.to_sink_config_dict` to work around this.
- **`TokenMintError` on session start**: OM admin credentials differ from defaults. Set `OM_ADMIN_EMAIL` / `OM_ADMIN_PASSWORD`, or export a pre-minted `OM_JWT_TOKEN`.
- **Filter variant `KeyError`**: your `_EXPECTED_TABLES_BY_VARIANT` dict is missing an entry for a scenario in `COMMON_FILTER_SCENARIOS`. The `expected_tables_for` helper turns this into a readable AssertionError naming the gap.
