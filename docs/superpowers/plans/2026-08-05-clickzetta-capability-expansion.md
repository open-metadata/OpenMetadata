# ClickZetta Capability Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ClickZetta support for profiling, sampling, data diff, native test execution, and the existing OpenMetadata dbt-artifact workflow without enabling an unvalidated data-reading path in production. Implement every capability that can be proven offline, then keep service registration behind bounded live gates.

**Architecture:** Treat each capability as an independent OpenMetadata service-spec contract. Keep the metadata/usage/lineage connector separate from the DBT artifact source, and add a ClickZetta implementation only after its generated SQL is covered by offline compilation tests and a bounded `seller_center` smoke test. Capability registration remains `None` until the corresponding gate is green, so an ingestion run cannot silently issue data scans.

**Tech Stack:** OpenMetadata 1.13.0 ingestion framework, Python 3.11, SQLAlchemy 2.x, `clickzetta-sqlalchemy==0.8.65.4`, `clickzetta-connector==1.0.30`, OpenMetadata profiler/sampler/data-quality interfaces, `data-diff`, pytest, Ruff.

## Global Constraints

- Do not change the EC2 deployment, the running OpenMetadata service, or production ClickZetta permissions from this branch.
- Use the existing `seller_center` schema and one explicitly named table for any future live smoke test; never run an unbounded table scan.
- Do not enable `profiler_class`, `sampler_class`, `test_suite_class`, or `data_diff` in `clickzetta/service_spec.py` until the capability-specific gates below pass.
- DBT extraction reads `manifest.json`, `catalog.json`, `run_results.json`, and `sources.json` from a DBT artifact source; it does not execute DBT models or query ClickZetta tables.
- Do not add a dependency; use the pinned ClickZetta and OpenMetadata 1.13.0 dependencies already in `ingestion/setup.py`.
- Every SQL-generating change must have an offline test that asserts bounded SQL and a live test plan that names the exact permission and result limit.
- A capability is “implemented” only when code, unit tests, container tests, and one bounded ClickZetta smoke test all pass; otherwise it remains explicitly unsupported.

---

## Current Evidence and Capability Boundaries

The current service spec registers metadata, usage, and lineage, and explicitly sets the data-reading interfaces to `None`:

```python
ServiceSpec = DefaultDatabaseSpec(
    metadata_source_class=get_class_path(ClickzettaSource),
    lineage_source_class=get_class_path(ClickzettaLineageSource),
    usage_source_class=get_class_path(ClickzettaUsageSource),
    connection_class=get_class_path(ClickzettaConnection),
    profiler_class=None,
    sampler_class=None,
    test_suite_class=None,
    data_diff=None,
)
```

This is intentional. `DefaultDatabaseSpec` otherwise supplies generic SQLAlchemy implementations. The ClickZetta SQLAlchemy dialect is not registered in `metadata.profiler.orm.registry.PythonDialects`, has no ClickZetta-specific ORM type converter, has no table-metric implementation, and is not in the supported data-diff dialect set. Enabling the generic defaults today would either fail at runtime or issue SQL that has not been validated against ClickZetta.

The DBT source is already implemented at `ingestion/src/metadata/ingestion/source/database/dbt/`. It reads DBT artifacts from local, HTTP, S3, GCS, Azure, or DBT Cloud and applies descriptions, owners, tags, glossary/domain metadata, tests, and lineage. This is a separate source workflow, not a ClickZetta database query feature. The ClickZetta connection schema keeps `supportsDBTExtraction` false until the attached-DBT UI path is validated; the existing S3 DBT pipeline remains the supported production path.

## File Map

- `ingestion/src/metadata/ingestion/source/database/clickzetta/service_spec.py`: capability registration; remains conservative until gates pass.
- `ingestion/src/metadata/ingestion/source/database/clickzetta/connection.py`: connection construction and test-connection behavior; no data-scan behavior belongs here.
- `ingestion/src/metadata/ingestion/source/database/clickzetta/metadata.py`: catalog extraction only.
- `ingestion/src/metadata/profiler/orm/registry.py`: SQLAlchemy service-to-dialect mapping required by profiler and diff code.
- `ingestion/src/metadata/profiler/orm/converter/converter_registry.py`: OpenMetadata column type to SQLAlchemy type mapping required to construct an ORM table.
- `ingestion/src/metadata/profiler/orm/functions/table_metric_computer.py`: row-count and table-metric dispatch; a ClickZetta implementation must not fall back to an unbounded query without proof.
- `ingestion/src/metadata/sampler/sqlalchemy/`: bounded sample generation and sample-data retrieval.
- `ingestion/src/metadata/data_quality/interface/sqlalchemy/`: SQLAlchemy test-suite runner.
- `ingestion/src/metadata/data_quality/validations/table/sqlalchemy/tableDiff.py`: shared data-diff validator and dialect allow-list.
- `ingestion/src/metadata/ingestion/source/database/dbt/`: existing artifact ingestion; no ClickZetta-specific extraction code is required for the S3 workflow.
- `ingestion/tests/unit/topology/database/test_clickzetta.py`: connection and metadata regression tests.
- `ingestion/tests/unit/topology/database/test_clickzetta_usage.py`: usage/lineage SQL and row mapping tests.
- `ingestion/tests/unit/topology/database/test_clickzetta_capabilities.py`: capability contract tests added in Task 1.
- `openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/clickzettaConnection.json`: UI/API capability flags and connection fields.
- `openmetadata-ui/src/main/resources/ui/public/locales/en-US/Database/Clickzetta.md`: operator-facing support and permission documentation.
- `docs/clickzetta-capability-matrix.md`: evidence, gates, and runbook for each capability.

---

### Task 1: Lock the capability contract and operator runbook

**Files:**
- Create: `ingestion/tests/unit/topology/database/test_clickzetta_capabilities.py`
- Create: `docs/clickzetta-capability-matrix.md`
- Modify: `openmetadata-ui/src/main/resources/ui/public/locales/en-US/Database/Clickzetta.md`

**Interfaces:**
- Consumes: `ServiceSpec` from `metadata.ingestion.source.database.clickzetta.service_spec`, the generated ClickZetta connection model, and the existing DBT source configuration names.
- Produces: regression coverage proving unsupported capability registrations stay disabled and an operator matrix that names the next gate rather than implying support.

- [x] **Step 1: Write the capability contract test**

```python
def test_clickzetta_keeps_unvalidated_data_capabilities_disabled():
    assert ServiceSpec.profiler_class is None
    assert ServiceSpec.sampler_class is None
    assert ServiceSpec.test_suite_class is None
    assert ServiceSpec.data_diff is None


def test_clickzetta_dbt_flag_defaults_to_disabled():
    config = ClickzettaConnection.model_validate(
        {
            "hostPort": "instance.example.clickzetta.test",
            "username": "catalog_reader",
            "authType": {"password": "not-used-in-this-test"},
            "databaseName": "quick_start",
            "virtualCluster": "DEFAULT_AP",
        }
    )
    assert config.supportsDBTExtraction is False
```

- [x] **Step 2: Run the contract test to verify the baseline**

Run:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=ingestion/src \
  .venv/bin/python -m pytest -q -p no:cacheprovider \
  ingestion/tests/unit/topology/database/test_clickzetta_capabilities.py
```

Expected: PASS, because the current branch intentionally exposes no unvalidated data-reading capability. If the test fails, repair the test fixture or generated-model import before continuing; do not enable a capability to make it pass.

- [x] **Step 3: Write the matrix and update the UI documentation**

Document the following exact statuses:

| Capability | Current state | Required implementation gate |
| --- | --- | --- |
| Metadata | Supported | Existing metadata unit/container/live probe |
| Usage and query lineage | Code-supported | `sys.information_schema.job_history` read permission plus bounded history smoke test |
| Profiling | Disabled | ClickZetta ORM type mapping, safe table metrics, SQL compilation, bounded seller-center smoke test |
| Sampling | Disabled | Bounded `LIMIT`/sampling SQL, PII/sample-storage review, bounded smoke test |
| Data diff | Disabled | ClickZetta dialect registration, data-diff key/hash SQL, two-table bounded test, cost review |
| Native test execution | Disabled | SQLAlchemy test-suite runner compatibility and permission/error semantics |
| DBT extraction | Separate source | S3 DBT pipeline with manifest/catalog/run-results; attached flag only after UI workflow validation |

- [x] **Step 4: Run the focused contract and documentation checks**

Run the pytest command from Step 2 and parse the ClickZetta JSON schema:

```bash
PYTHONPATH=ingestion/src .venv/bin/python - <<'PY'
import json
from pathlib import Path

path = Path("openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/clickzettaConnection.json")
json.loads(path.read_text())
print("clickzetta schema: valid JSON")
PY
```

- [x] **Step 5: Commit**

```bash
git add ingestion/tests/unit/topology/database/test_clickzetta_capabilities.py \
  docs/clickzetta-capability-matrix.md \
  openmetadata-ui/src/main/resources/ui/public/locales/en-US/Database/Clickzetta.md
git commit -m "docs(clickzetta): define capability support gates"
```

### Task 2: Close the native usage/query-lineage live gate

**Files:**
- Modify: `ingestion/src/metadata/ingestion/source/database/clickzetta/queries.py`
- Modify: `ingestion/src/metadata/ingestion/source/database/clickzetta/query_parser.py`
- Test: `ingestion/tests/unit/topology/database/test_clickzetta_usage.py`
- Modify: `docs/clickzetta-capability-matrix.md`

**Interfaces:**
- Consumes: `queryHistoryTable=sys.information_schema.job_history`, configured workspace/schema, and ClickZetta native columns.
- Produces: canonical OpenMetadata `TableQuery` rows from bounded native history SQL.

- [x] **Step 1: Add and pass the offline native-column mapping test**

The test must assert `job_text`, `job_type`, `job_creator`, `workspace_name`, `input_tables`, `execution_time`, and status map to the canonical fields and that workspace/schema predicates are present.

- [x] **Step 2: Implement only the projection/filter mapping**

Use the existing wrapper query and never change the configured result limit or time-window behavior. Do not add a generic `SELECT *` fallback.

- [x] **Step 3: Run the focused local and container tests**

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=ingestion/src \
  .venv/bin/python -m pytest -q -p no:cacheprovider \
  ingestion/tests/unit/topology/database/test_clickzetta_usage.py \
  ingestion/tests/unit/topology/database/test_clickzetta.py
```

Then run the same files inside `docker.getcollate.io/openmetadata/ingestion:1.13.0`.

- [ ] **Step 4: Run one live `LIMIT 0` history smoke test only after an administrator grants read metadata/select access**

Required external grant: a least-privilege ClickZetta role that can read `sys.information_schema.job_history` and the configured `seller_center` metadata. The smoke test must use `LIMIT 0`, a one-table schema filter, and record the permission/result without printing credentials.

- [x] **Step 5: Commit**

```bash
git add ingestion/src/metadata/ingestion/source/database/clickzetta \
  ingestion/tests/unit/topology/database/test_clickzetta_usage.py \
  docs/clickzetta-capability-matrix.md
git commit -m "feat(clickzetta): map native job history"
```

### Task 3: Add a ClickZetta profiler implementation behind a gate

**Files:**
- Create: `ingestion/src/metadata/profiler/interface/sqlalchemy/clickzetta/profiler_interface.py`
- Create: `ingestion/src/metadata/profiler/interface/sqlalchemy/clickzetta/__init__.py`
- Modify: `ingestion/src/metadata/profiler/orm/registry.py`
- Modify: `ingestion/src/metadata/profiler/orm/converter/converter_registry.py`
- Modify: `ingestion/src/metadata/profiler/orm/functions/table_metric_computer.py`
- Modify: `ingestion/src/metadata/ingestion/source/database/clickzetta/service_spec.py`
- Modify: `openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/clickzettaConnection.json`
- Create: `ingestion/tests/unit/profiler/test_clickzetta_profiler.py`

**Interfaces:**
- Consumes: OpenMetadata table entities and the ClickZetta SQLAlchemy engine.
- Produces: only metrics proven to compile and execute on ClickZetta; failures must abort/skip with a useful diagnostic instead of silently falling back to a full table scan.

- [x] **Step 1: Write failing offline compilation tests**

Cover ORM column conversion for numeric, string, date, boolean, and array types; row-count SQL; null-count SQL; and the configured bounded sample query. Assert the compiled dialect is `clickzetta` and the SQL contains a limit or an explicitly approved aggregate.

- [x] **Step 2: Register the ClickZetta dialect and common type converter**

Add `PythonDialects.Clickzetta = "clickzetta"` and map ClickZetta to the common converter only after tests prove every supported OpenMetadata type maps to a SQLAlchemy type.

- [x] **Step 3: Implement a minimal ClickZetta profiler**

Reuse `SQAProfilerInterface`; override only the ClickZetta-specific metric/table behavior. Start with row count, null count, and supported numeric aggregates. Do not expose system metrics, window metrics, approximate statistics, or array expansion until each SQL form has a ClickZetta test.

- [x] **Step 4: Run local/container tests and inspect generated SQL**

Run the focused profiler tests, existing ClickZetta tests, Ruff on changed Python files, and the containerized focused suite.

- [ ] **Step 5: Run one bounded live smoke test**

Use exactly one `seller_center` table, a configured sample limit, and a short timeout. Verify the OpenMetadata profile result and ClickZetta job history; do not run a whole-schema profiler.

- [ ] **Step 6: Enable the service spec and schema flag only after the smoke test passes**

Set `profiler_class` to the ClickZetta class and add `supportsProfiler` to the schema with a false default. The pipeline must remain opt-in.

- [ ] **Step 7: Commit**

```bash
git add ingestion/src/metadata/profiler ingestion/src/metadata/ingestion/source/database/clickzetta/service_spec.py \
  openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/clickzettaConnection.json \
  ingestion/tests/unit/profiler/test_clickzetta_profiler.py
git commit -m "feat(clickzetta): add gated profiler support"
```

### Task 4: Add bounded sampling and sample-data safeguards

**Files:**
- Create: `ingestion/src/metadata/sampler/sqlalchemy/clickzetta/sampler.py`
- Create: `ingestion/src/metadata/sampler/sqlalchemy/clickzetta/__init__.py`
- Modify: `ingestion/src/metadata/ingestion/source/database/clickzetta/service_spec.py`
- Modify: `openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/clickzettaConnection.json`
- Create: `ingestion/tests/unit/sampler/test_clickzetta_sampler.py`

**Interfaces:**
- Consumes: a table entity plus OpenMetadata `DatabaseSamplerConfig`.
- Produces: a bounded `LIMIT n` sample with column filters, no implicit percentage/full-table scan, and no sample persistence unless the operator explicitly enables it.

- [x] **Step 1: Write failing SQL-bound tests**

Assert the sample query always has a positive limit, preserves quoted database/schema/table identifiers, rejects an empty/unbounded custom query, and honors included/excluded columns.

- [x] **Step 2: Implement the smallest sampler**

Subclass `SQASampler`; use ClickZetta's validated `LIMIT` syntax and disable percentage/random sampling until a ClickZetta-native equivalent is proven. Raise a configuration error rather than silently querying the full table.

- [x] **Step 3: Run unit/container tests; live seller-center smoke remains pending**

Verify row count, sample width, sample limit, and no data outside the configured schema is read. Use a test table with non-sensitive values where possible.

- [ ] **Step 4: Register sampler only after the smoke test**

Enable the `sampler_class` and `supportsProfiler` connection capability together; sampling is a prerequisite for profiling, classification, and native tests.

- [ ] **Step 5: Commit**

```bash
git add ingestion/src/metadata/sampler/sqlalchemy/clickzetta \
  ingestion/src/metadata/ingestion/source/database/clickzetta/service_spec.py \
  openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/clickzettaConnection.json \
  ingestion/tests/unit/sampler/test_clickzetta_sampler.py
git commit -m "feat(clickzetta): add bounded sampler"
```

### Task 5: Add native test execution after sampler compatibility

**Files:**
- Create: `ingestion/src/metadata/data_quality/interface/sqlalchemy/clickzetta/test_suite_interface.py`
- Create: `ingestion/src/metadata/data_quality/interface/sqlalchemy/clickzetta/__init__.py`
- Modify: `ingestion/src/metadata/ingestion/source/database/clickzetta/service_spec.py`
- Modify: `openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/clickzettaConnection.json`
- Create: `ingestion/tests/unit/data_quality/test_clickzetta_test_suite.py`

**Interfaces:**
- Consumes: the ClickZetta sampler, `SQATestSuiteInterface`, OpenMetadata test definitions, and a ClickZetta SQLAlchemy session.
- Produces: standard OpenMetadata test results with explicit `Success`, `Failed`, and `Aborted` mapping; no DDL or test-data mutation.

- [x] **Step 1: Write failing tests for SQL expression and result mapping**

Cover table row count, column not-null, uniqueness, custom SQL, permission denial, and timeout. Assert an unsupported SQL expression returns `Aborted` with the source error rather than `Success`.

- [x] **Step 2: Implement the ClickZetta session/test adapter**

Reuse `SQATestSuiteInterface` and override only identifier quoting, session setup, and ClickZetta-specific error mapping. Keep the test runner read-only.

- [x] **Step 3: Run unit/container tests**

Run the data-quality tests, ClickZetta focused suite, and Ruff. No live test is allowed until a non-production table and least-privilege test role are available.

- [ ] **Step 4: Run a bounded live test suite**

Execute one row-count and one not-null test on one `seller_center` test table. Verify the OpenMetadata test result and ClickZetta job history; do not run an entire suite by default.

- [ ] **Step 5: Register and commit**

Enable `test_suite_class` and the corresponding schema capability only after the live gate passes, then commit:

```bash
git add ingestion/src/metadata/data_quality/interface/sqlalchemy/clickzetta \
  ingestion/src/metadata/ingestion/source/database/clickzetta/service_spec.py \
  openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/clickzettaConnection.json \
  ingestion/tests/unit/data_quality/test_clickzetta_test_suite.py
git commit -m "feat(clickzetta): add native test execution"
```

### Task 6: Add data diff as a separate, opt-in capability

**Files:**
- Create: `ingestion/src/metadata/ingestion/source/database/clickzetta/data_diff/__init__.py`
- Create: `ingestion/src/metadata/ingestion/source/database/clickzetta/data_diff/data_diff.py`
- Create: `ingestion/src/metadata/ingestion/source/database/clickzetta/data_diff/table_parameter.py`
- Modify: `ingestion/src/metadata/ingestion/source/database/clickzetta/service_spec.py`
- Modify: `openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/clickzettaConnection.json`
- Create: `ingestion/tests/unit/data_quality/test_clickzetta_data_diff.py`

**Interfaces:**
- Consumes: two ClickZetta table parameters, explicitly configured key columns, and `data-diff`.
- Produces: schema and row differences with bounded key ranges; no automatic full-table diff.

- [x] **Step 1: Write failing tests for dialect registration and hash/key SQL**

Assert ClickZetta is rejected before registration, then accepted only for the tested key/hash expression and identifier quoting. Assert missing key columns produce `Aborted`.

- [x] **Step 2: Implement ClickZetta table parameters and SQL expression support**

Use the shared table-diff validator, add a ClickZetta dialect mapping, and keep key-column selection mandatory. The shared validator remains unchanged; the connector-specific table parameter registers the dialect only when a future service spec explicitly imports it. Do not copy the Databricks implementation without proving ClickZetta semantics.

- [x] **Step 3: Run unit/container tests; two-table live smoke remains pending**

Use two small, non-production seller-center tables or snapshots. Record query count, row limit, and runtime.

- [ ] **Step 4: Register only after the smoke test and commit**

```bash
git add ingestion/src/metadata/ingestion/source/database/clickzetta/data_diff \
  ingestion/src/metadata/data_quality/validations/table/sqlalchemy/tableDiff.py \
  ingestion/src/metadata/ingestion/source/database/clickzetta/service_spec.py \
  openmetadata-spec/src/main/resources/json/schema/entity/services/connections/database/clickzettaConnection.json \
  ingestion/tests/unit/data_quality/test_clickzetta_data_diff.py
git commit -m "feat(clickzetta): add opt-in data diff support"
```

### Task 7: Validate and document the DBT artifact workflow

**Files:**
- Modify: `openmetadata-ui/src/main/resources/ui/public/locales/en-US/Database/Clickzetta.md`
- Modify: `docs/clickzetta-capability-matrix.md`
- Test: existing DBT source tests under `ingestion/tests/unit/topology/database/dbt/`

**Interfaces:**
- Consumes: S3 `manifest.json`, optional `catalog.json`, `run_results.json`, and `sources.json`.
- Produces: OpenMetadata table/column descriptions, owners, tags, glossary/domain references, DBT tests, and lineage through the existing DBT source.

- [ ] **Step 1: Add a fixture-level test for S3 artifact discovery**

Assert the source reads the latest manifest path and treats catalog/run-results as optional artifacts without querying ClickZetta.

- [x] **Step 2: Document the production sequence**

After a merge: run `dbt parse` (or the already-approved affected-model artifact job), upload the artifact set to S3 atomically, then trigger the OpenMetadata DBT ingestion. Run ClickZetta metadata ingestion separately only when catalog structure changes or a usage/lineage window needs refresh.

- [x] **Step 3: Keep `supportsDBTExtraction` false until the attached UI workflow is tested**

The separate S3 DBT ingestion remains the production path. Change the flag in a later, isolated task only after the UI creates the expected DBT source and the same S3 artifacts are ingested successfully.

- [ ] **Step 4: Commit**

```bash
git add openmetadata-ui/src/main/resources/ui/public/locales/en-US/Database/Clickzetta.md \
  docs/clickzetta-capability-matrix.md \
  ingestion/tests/unit/topology/database/dbt
git commit -m "docs(clickzetta): document separate dbt artifact ingestion"
```

### Task 8: Release gates and upstream handoff

**Files:**
- Modify: `docs/clickzetta-capability-matrix.md`
- Modify: `openmetadata-ui/src/main/resources/ui/public/locales/en-US/Database/Clickzetta.md`
- Test: all changed ClickZetta, profiler, sampler, data-quality, and DBT tests

**Interfaces:**
- Consumes: capability-specific test evidence, container evidence, and live smoke-test logs with credentials removed.
- Produces: a PR-ready support statement that separates implemented features from pending external permission/environment gates.

- [x] **Step 1: Run local focused tests, Ruff, JSON parsing, and container tests**

- [x] **Step 2: Confirm no production/EC2 files or credentials changed**

Run `git status`, inspect the diff, and verify no `.env.local` or secret material is staged.

- [x] **Step 3: Update the matrix with exact evidence and remaining gates**

- [ ] **Step 4: Commit each independently reviewable capability**

- [ ] **Step 5: Open/update the upstream PR only after the corresponding capability has passed all gates**

## Execution log

- Task 1 contract/matrix phase: complete in commits `b4424d92c2` and `bc49650097`.
- Existing native job-history mapping phase: local and container tests complete in commit `a8600d9346`; the live gate is pending read access to `sys.information_schema.job_history`.
- Offline capability expansion: bounded sampler, guarded profiler, read-only test-suite adapter, and opt-in data-diff adapter implemented on the current branch; service registrations remain `None` pending live gates.
- Focused local validation: `44 passed, 7 warnings` across ClickZetta metadata/usage/capability, sampler, profiler, test-suite, and data-diff tests.
- OpenMetadata 1.13.0 container validation: `42 passed, 2 skipped, 7 warnings`; the two skips are ClickZetta SQLAlchemy compilation tests because the stock image does not install the ClickZetta extras.
- Ruff check and format validation: passed for all changed Python files.
- ClickZetta schema JSON parse: passed.
- Existing offline DBT artifact validation: `162 passed, 7 warnings` across manifest/catalog parsing and HTTP artifact configuration tests; no ClickZetta query was issued.
- No EC2 deployment, production data scan, or ClickZetta permission change was performed. The safety gate explicitly rejects unbounded custom sampling SQL and data-diff queries without `allowFullTableScan=true`.
