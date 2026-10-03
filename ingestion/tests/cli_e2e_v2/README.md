# CLI E2E v2

Real source → `metadata` subprocess → real OpenMetadata sink/server → persisted SDK observations.
MySQL is the reference connector. Postgres has a native v2 suite, BigQuery is the first cloud-warehouse migration (see [BigQuery](#bigquery)), Oracle is the first source whose schemas are database users (see [Oracle](#oracle)), and Snowflake reads its lagging ACCOUNT_USAGE views through an owned real-time shim (see [Snowflake](#snowflake)). Dashboard authoring is design-validated only; this suite does not ship live Metabase coverage.

| Connector | Source ownership | v1 path it replaces |
|---|---|---|
| `mysql` | disposable testcontainers MySQL + restricted account, fresh schema per test | `cli_e2e/test_cli_mysql.py` |
| `postgres` | disposable testcontainers Postgres + restricted account, fresh schema per test | `cli_e2e/test_cli_postgres.py` |
| `bigquery` | fresh labelled dataset per test in two real GCP projects | `cli_e2e/test_cli_bigquery.py`, `cli_e2e/test_cli_bigquery_multiple_project.py` |
| `oracle` | disposable testcontainers Oracle + restricted account, fresh schema (an Oracle user) per test | `cli_e2e/test_cli_oracle.py` |
| `snowflake` | fresh schema per test in one real Snowflake database | `cli_e2e/test_cli_snowflake.py` |

## Run

From the repository root, activate a development virtual environment with the ingestion package, connector dependencies, and pytest installed. MySQL, Postgres and Oracle also require testcontainers and Docker for their disposable sources. Supply a running, compatible OpenMetadata server separately; the suite does not provision or stop that server.

```bash
source env/bin/activate
export PYTHONPATH=ingestion/src
export OM_SERVER_URL=http://localhost:8585/api
python -m pytest ingestion/tests/cli_e2e_v2/mysql --e2e-contract-check -v
python -m pytest ingestion/tests/cli_e2e_v2/postgres --e2e-contract-check -v
```

Use `OM_JWT_TOKEN` for an existing token. Without it, `server.py` authenticates with `OM_ADMIN_EMAIL` / `OM_ADMIN_PASSWORD` (defaults: `admin@open-metadata.org` / `admin`) and obtains the ingestion-bot token. Missing credentials, unreachable services, and failed provisioning are errors, not skips.

The MySQL and Postgres fixtures each own a disposable container, restricted ingestion account, and unique per-test schemas. Every Postgres workflow uses an anchored include filter for its owned schemas. Each test also owns a unique OM service. Cleanup runs after setup or call failures; cleanup failures remain teardown errors alongside the original failure. Never point these mutating fixtures at a shared source or reset somebody else's schema.

Focused runs do not require completeness checking:

```bash
python -m pytest ingestion/tests/cli_e2e_v2/mysql/test_metadata.py::test_mark_deleted_tables_on_reingest -v
```

Framework meta-tests require no Docker, server credentials, or network access:

```bash
env -u OM_JWT_TOKEN OM_SERVER_URL=http://127.0.0.1:1/api \
  python -m pytest ingestion/tests/cli_e2e_v2/meta -q
```

The shared Python CI workflow runs this offline suite once, on Python 3.10, when E2E code,
ingestion dependency/test configuration, generated-model schemas, or the relevant CI wiring changes.
It reuses the unit-test environment and does not run live connectors. Unrelated changes skip this step;
manual Python workflow runs include it. The live connector workflow remains manually triggered.

## Boundaries

```text
cli_e2e_v2/
  runtime/             subprocess, typed status, polling
  features/database/   generated pipeline options, catalog/profile/sample/lineage checks
  contracts/           coverage inventory, collection validation, required-result enforcement
  mysql/               owned source, context, expectations, checks, named feature tests
  postgres/            owned Postgres source, v1 migration inventory, named feature tests
  bigquery/            owned datasets in two GCP projects, same layout as mysql/ plus test_data_quality.py
  oracle/              owned container and one Oracle user per test, same layout as mysql/
  snowflake/           owned schemas in one Snowflake database, bigquery/ layout plus test_features.py
  meta/                offline runtime and framework behavior tests
  server.py            explicit OM configuration and authentication
  conftest.py          shared fixtures and thin pytest hooks
```

MySQL tests explicitly call `cli.run(mysql.invocation(options))`, then `expect.poll(query).satisfies(check)`. The `mysql` context binds source identity, configuration, and fresh queries; it does not run ingestion, own cleanup, or cache observations. Fixtures provision the source and service, while named pytest tests show the actions and assertions in execution order.

`catalog_matches(expected)` always compares complete catalog inventory, including duplicate and parent-reference checks. Supplied table, column, and procedure descriptions match exactly; `ExpectedTable.table_type` checks table/view type when supplied. Optional fields set to `None` remain unchecked. Feature prerequisites use targeted entity queries instead of partial catalog matching.

Catalog checks traverse the fixed database tree through typed functions, without a node registry. Database pipeline command, source suffix, and processor selection share one specification. SQL baselines contain table metadata, seeds, and ordered DDL statements; persisted expectations remain independent of those statements.

Shared offline subprocess setup, network guards, and executable probes live in `meta/support.py`. Meta-tests import these helpers directly instead of importing infrastructure from other meta-test modules.

Only checker `AssertionError` mismatches retry. SDK, transport, parsing, and checker programming errors fail immediately. Every polling assertion gets a fresh budget; increasing that budget cannot cancel a blocking SDK read or repair an incorrect expectation.

`CliRunner(work_dir: Path, *, command=("metadata",))` writes an isolated temporary `config.yaml` and requires the CLI to produce `status.json` for each invocation. It returns `RunResult(exit_code, status)` only after validating the expected exit code, typed status success, and exact total record-error count independently. Normal runs require zero errors, even when the workflow's success threshold accepts partial failures. Negative cases must explicitly set `expected_errors` as well as the expected exit and success. Missing or malformed status is a failure, even with exit code zero. CLI timeouts fail the test; on POSIX, process-group cleanup also terminates child processes after completion or cancellation.

Read [CONNECTORS.md](CONNECTORS.md) for source ownership, complete SQL case wiring, custom scenarios, and an illustrative dashboard extension. New connectors do not need a runtime subclass, mutable fluent assertion object, or enforcer hierarchy.

The MySQL and Postgres scenarios are grouped into `test_metadata.py`, `test_profiles.py`, and `test_samples.py`. Each `test_fixture_safety.py` checks isolation, read-only ingestion privileges, and failure-path cleanup against the real source without an OpenMetadata server. These safeguards are distinct from feature assertions: successful ingestion cannot prove that teardown removed a container. Run them independently with:

```bash
python -m pytest ingestion/tests/cli_e2e_v2/mysql/test_fixture_safety.py -v
python -m pytest ingestion/tests/cli_e2e_v2/postgres/test_fixture_safety.py -v
```

## Coverage and known failures

`--e2e-contract-check` loads `INVENTORY` from each selected connector's `inventory.py`. There is no central connector registry or default database inventory; a missing, empty, or incorrectly identified inventory fails collection. Each supported required ID needs exactly one collected `e2e_contract` mark. Unknown, duplicate, missing, skipped, or xfailed cases fail collection. Runtime skips and xfails (including non-strict XPASS) also fail required contracts during setup, execution, or teardown. Unsupported capabilities require a reviewed reason and cannot contradict a declared generated support flag. A connector's inventory records scope; it is not a runtime plugin registry.

Completeness mode intentionally rejects node IDs, files, and selection options (`-k`, `-m`, `--deselect`, added `--ignore`, `--ignore-glob`, and `--lf`). Use it for full-suite runs, not local selection. Passing collection proves inventory completeness, not connector correctness.

The MySQL native sample checks deliberately retain strict YEAR/BIT/null expectations. Row-count and column-freshness scenarios remain independently executable while `useStatistics` behavior is investigated. These are genuine red assertions when observed values differ: do not add skips, xfails, allowlists, or exit-code rewriting to report a green framework run.

The separate `sample.values.replacement` scenario samples the same table before and after a source mutation,
checking integer and null values independently of the strict native-type scenarios.

### Postgres v1 migration inventory

The v2 Postgres suite replaces the observable assertions in `cli_e2e/test_cli_postgres.py` and its inherited `CliDBBase.TestSuite` methods. Each contract checks persisted OpenMetadata state rather than v1 status-count floors. The v1 path remains in place during the agreed CI stability window.

| v1 behavior | v2 contracts |
|---|---|
| Vanilla ingestion and 22 native Postgres types | `catalog.metadata`, `fk.relationships`, `ingest.repeat` |
| Profiler and auto-classification sample | `profile.metrics`, `sample.values.original`, `sample.values.updated`, `sample.values.replacement` |
| Delete and re-ingest | `deletion.tables` |
| Schema include/exclude filters | `filter.schema.include-one`, `filter.schema.exclude-wins` |
| Table include/exclude/mixed filters | `filter.table.include-one`, `filter.table.exclude-one`, `filter.table.regex-exclude-wins`, `filter.table.exclude-wins` |
| View and all 22 column lineages | `lineage.view` |
| Auto-classification | `classification.tags` |

The inherited v1 usage method has no assertions, and Postgres has no declared system-profile cases. Partition profiling skips without a Postgres-specific configuration, and data quality returns without a Postgres test table. These are not claimed as migrated coverage. The v2 workflow's manual dispatch includes Postgres, while the v1 workflow keeps its Postgres entry until the stability window completes.

## Debugging and reporting

The CLI inherits stdout and stderr. Pytest's default file-descriptor capture includes subprocess output and displays it with setup, call, or teardown failures. CI uses that ordinary pytest output; there is no custom publisher, report sanitizer, or assertion ledger.

- Default capture keeps successful runs quiet and shows captured output for failures.
- Add `-rP` to show captured output from passing tests, or `-rA` for all summary categories, including passing output. Both increase CI log volume.
- Add `-s` for live stdout/stderr in a single-process run. This disables capture, so output is immediate and is not repeated in captured failure sections. With pytest-xdist, keep default file-descriptor capture so worker subprocess stdout is retained.

For a CLI failure, inspect the reported exit/status mismatch and captured subprocess output. For a persisted-state failure, the polling assertion reports the query label, attempts, elapsed time, and final mismatch. A successful CLI exit does not establish that the expected entities, values, or relationships were persisted.

Temporary `config.yaml` and `status.json` files are test input and status-validation data, not a publication contract. They may contain credentials or sensitive failure details; do not dump them or upload the whole pytest temporary directory. Keep credential-bearing fixture fields out of object representations with `repr=False`, and avoid logging workflow configs, connection strings, passwords, or tokens.

Use the CI provider's native secret masks for actual configured and generated credentials before any command can print them. Masking is not a detector for unknown secrets. Test product redaction with synthetic values in focused tests; this E2E harness does not scrub output to conceal a product redaction defect.

CI log masking does not sanitize JUnit files. Avoid `--showlocals` with real credentials, and review any report-upload policy separately.

## BigQuery

BigQuery cannot run in a container, so `bigquery/` owns one fresh dataset per test (`e2e_bq_<uuid>`,
label `owner=cli-e2e-v2`, 24h default table expiration as a leak safety net) and deletes it with its
contents on success and failure. Every workflow carries an anchored `schemaFilterPattern` for the
owned datasets, because the projects also hold unowned data; the invocation helper rejects a schema
filter without explicit includes. Missing credentials are errors, not skips.

```bash
export E2E_BQ_PROJECT_ID=...        # primary project: owned datasets, ingested as the OM database
export E2E_BQ_PROJECT_ID2=...       # second project: multi-project scenarios and billingProjectId
export E2E_BQ_PRIVATE_KEY_ID=... E2E_BQ_PRIVATE_KEY=... E2E_BQ_CLIENT_EMAIL=...
export E2E_BQ_LOCATION=US           # optional; dataset location and usageLocation
python -m pytest ingestion/tests/cli_e2e_v2/bigquery --e2e-contract-check -v
```

Locally, `E2E_BQ_AUTH=adc` uses Application Default Credentials (`gcloud auth application-default login`)
for both the fixtures and the CLI (`gcpConfig.type: gcp_adc`); the `E2E_BQ_PRIVATE_KEY*` / `E2E_BQ_CLIENT_EMAIL`
variables are then unused. The default, `service_account`, is what CI uses.

The service account needs BigQuery User (dataset create, jobs) and Data Editor on **both** projects.
There is no restricted ingestion account: the same identity seeds and ingests.
`E2E_BQ_PRIVATE_KEY` may use real or `\n`-escaped newlines; the session exports a single-line copy as
`E2E_BQ_CLI_PRIVATE_KEY` because the CLI expands `${VARS}` before parsing YAML.
Single-project runs set `billingProjectId` to the second project (as v1 did); the system-metrics
scenario therefore issues its DML through the billing project, whose `INFORMATION_SCHEMA.JOBS`
the connector reads, and waits until those jobs are visible before profiling.

v1 → v2 mapping:

| v1 behaviour | v2 contract |
|---|---|
| vanilla ingestion, no failures, ≥ N records | `catalog.metadata` (complete inventory, native types, keys, descriptions, view, procedure) |
| multi-project credentials (`projectId` list) | `catalog.multi-project`, `filter.database.include-one` |
| schema include/exclude filters | `filter.schema.include-one`, `filter.schema.exclude-wins` |
| table include/exclude/mix filters (filtered-count floors) | `filter.table.*` (always combined with the owned-schema filter) |
| create table + profiler | `profile.metrics` |
| system profile INSERT/UPDATE rows | `profile.system` (also rejects sibling-table DML) |
| profiler defaults to the latest partition | `profile.partition.default` |
| auto-classification, 50 sample rows | `sample.limit`, `classification.tags` |
| deleted table marked deleted | `deletion.tables` |
| view lineage, 2 column edges | `lineage.view` |
| `tableDiff` data-quality test | `dq.table-diff` |

The v2 partition contract now checks the inferred three-day window with rows clearly inside and outside it.

Added beyond v1: `procedure.code`, `fk.relationships`, `ingest.repeat`, `sample.values.native`,
`sample.values.replacement`. v1's lineage run enabled query-log lineage but asserted only view
lineage; query-log lineage and policy-tag taxonomies stay out of scope, as for MySQL.

Fixed while migrating, each found by a strict assertion here: `NUMERIC`/`BIGNUMERIC` → `NUMERIC` and `JSON` → `JSON`
types, per-table system metrics, foreign keys to the current database, `ARRAY`/`STRUCT` nullability constraints,
STRUCT-subfield sampling and unique counts, and a shared-session race between profiler metric threads.

Do not relax these expectations to report a green run. Running with ADC as a user without project-level
`bigquery.tables.list` on the second project also fails `catalog.multi-project` on the region-scoped
life-cycle query (403). That is a permission difference in the environment, not a product defect.

Remove the v1 BigQuery tests and their `py-cli-e2e-tests.yml` matrix entries only after this suite has
passed for the agreed stability window.
The manually dispatched v2 workflow runs BigQuery with six workers and passes the existing test
environment credentials only to its BigQuery matrix job.

## Oracle

`oracle/` boots a disposable Oracle via testcontainers (`gvenzl/oracle-free`, digest-pinned) and
owns one schema per test. In Oracle a schema **is** a user, so each test runs `CREATE USER` and
tears down with `DROP USER ... CASCADE`; a separate least-privilege account does the ingesting with
`CREATE SESSION`, `SELECT_CATALOG_ROLE` and per-object `SELECT`. No credentials or ports to manage,
so the `E2E_ORACLE_*` secrets v1 needed are gone.

```bash
docker compose -f docker/development/docker-compose.yml up -d
python -m pytest ingestion/tests/cli_e2e_v2/oracle --e2e-contract-check -v
```

Every workflow carries an anchored `schemaFilterPattern` for the owned schemas. The connector reads
the `DBA_` dictionary views, so an unscoped run would discover every schema in the instance, and
unlike MySQL there is no connection-level scope to fall back on: `oracleConnectionType` takes a
service name *or* a `databaseSchema`, never both.

**Identifier case.** `expected.py` encodes what OM actually stores, which is not uniform:

| Entity | Case |
|---|---|
| database | `default` — not the Oracle service name |
| schema | lowercase |
| tables, stored procedures | **UPPERCASE** — dictionary name, verbatim |
| views, columns | lowercase — normalised on their own paths |

That split is pre-existing and costs users nothing, so this suite encodes it rather than changing
it; normalising table names would rename every existing Oracle table's FQN. Two consequences when
writing tests here: hand-written DDL in `baseline.py` must leave the schema **unquoted** (quoting it
looks for a lowercase user `CREATE USER` never created), and auto-classification filter patterns
must match the stored case — the metadata pipeline matches `tableFilterPattern` case-insensitively
but the classification path does not, so a lowercase pattern silently selects nothing.

v1 → v2 mapping:

| v1 behaviour | v2 contract |
|---|---|
| vanilla ingestion, no failures, ≥ N records | `catalog.metadata` (complete inventory, native types, keys, descriptions, view, procedures) |
| schema include filter | `filter.schema.include-one` |
| table include / exclude / mix filters (filtered-count floors) | `filter.table.include-one`, `filter.table.exclude-one`, `filter.table.mix` |
| create table + profiler | `profile.metrics` |
| auto-classification sample data | `sample.values.original`, `sample.values.replacement`, `classification.tags` |
| deleted table marked deleted | `deletion.tables` |
| view lineage | `lineage.view` |

Added beyond v1: `procedure.code`, `fk.relationships`, `ingest.repeat`. v1 exercised none of them.

v1 tests with no v2 counterpart exercise nothing: `test_usage` has an empty body,
`test_schema_filter_excludes` is a bare `pass`, and `test_profiler_with_time_partition` and
`test_data_quality` guard themselves off because Oracle defines no hook for them.

`error.containment` is declared `unsupported` in the inventory with its reason: Oracle keeps
dictionary metadata for invalid views, so the reference induction produces no ingestion error.
Neither dropping a selected column nor dropping the base table makes a view fail reflection.

Fixed while migrating, found by a strict assertion here: foreign keys were silently dropped because
`get_foreign_keys` reported `referred_table` normalised while `get_table_names` returns the
dictionary name verbatim, so the exact-FQN lookup never matched.

Remove the v1 Oracle test and its `py-cli-e2e-tests.yml` matrix entry only after this suite has
passed for the agreed stability window.

## Snowflake

Snowflake cannot run in a container, so `snowflake/` owns one fresh schema per test (`E2E_SF_<uuid>`,
comment `owner=cli-e2e-v2`, zero Time Travel retention) in the configured database and drops it with
`CASCADE` on success and failure. Every workflow sets the connection `database` and carries an anchored
`schemaFilterPattern` for the owned schemas, because the database also holds unowned schemas. The
invocation helper rejects a schema filter that includes anything beyond the owned schemas' anchored
patterns. Missing credentials are errors, not skips.

```bash
export E2E_SNOWFLAKE_ACCOUNT=... E2E_SNOWFLAKE_USERNAME=... E2E_SNOWFLAKE_WAREHOUSE=... E2E_SNOWFLAKE_DATABASE=...
export E2E_SNOWFLAKE_PRIVATE_KEY=...      # PEM, real or \n-escaped newlines
export E2E_SNOWFLAKE_PASSPHRASE=...       # optional, for an encrypted key
export E2E_SNOWFLAKE_ROLE=...             # optional
python -m pytest ingestion/tests/cli_e2e_v2/snowflake --e2e-contract-check -v
```

The default `E2E_SNOWFLAKE_AUTH=key_pair` is what CI uses. The session exports a single-line copy of the
key as `E2E_SNOWFLAKE_CLI_PRIVATE_KEY` because the CLI expands `${VARS}` before parsing YAML. For a test
account without MFA, `E2E_SNOWFLAKE_AUTH=password` reads `E2E_SNOWFLAKE_PASSWORD` instead. Every test logs
in several times, so never point this suite at a password account that prompts for MFA. The role needs
`CREATE SCHEMA` on the database, usage on the warehouse (dynamic tables refresh on it), and
`IMPORTED PRIVILEGES` on the `SNOWFLAKE` database. One identity seeds and ingests. The workflow connection
pins `GEOGRAPHY_OUTPUT_FORMAT=GeoJSON` through `connectionArguments.session_parameters`, so the sampled
values do not depend on the account's configured format.

### ACCOUNT_USAGE shim

The connector lists routines, tags and query history from `SNOWFLAKE.ACCOUNT_USAGE`, whose views lag by up
to two hours, so no freshly created object is visible there during a test. v1 therefore asserted nothing
about routines or tags and marked its system-metrics test as a flaky expected failure. Here,
`SnowflakeSource.account_usage_shim()` creates a sibling owned schema (`<schema>_AU`, outside the schema
filter) and the latency-bound scenarios point the real `accountUsageSchema` connection setting at it:

| View | Source |
|---|---|
| `PROCEDURES`, `FUNCTIONS` | the database's `INFORMATION_SCHEMA` views, plus a NULL `DELETED` |
| `TAG_REFERENCES` | `TAG_REFERENCES` and `TAG_REFERENCES_ALL_COLUMNS` for the database, the schema and each of its tables, without the `INHERITED` rows that ACCOUNT_USAGE omits |
| `QUERY_HISTORY` | `INFORMATION_SCHEMA.QUERY_HISTORY()`, whose real `ROWS_INSERTED` is kept. It reports no update or delete counts (and `ROWS_PRODUCED` counts rewritten rows), so the test records each DML statement's own result row and the view joins it by `QUERY_ID` |
| `TABLES`, `ACCESS_HISTORY`, `DYNAMIC_TABLE_REFRESH_HISTORY`, `COPY_HISTORY` | pass-through to `SNOWFLAKE.ACCOUNT_USAGE` |

`test_fixture_safety.py` runs the connector's own ACCOUNT_USAGE queries against the shim, and an offline
meta-test fails when the connector starts reading a view the shim does not provide. Every other scenario
reads the real `SNOWFLAKE.ACCOUNT_USAGE` with `includeStoredProcedures=False`, so its catalog stays
deterministic.

v1 → v2 mapping:

| v1 behaviour | v2 contract |
|---|---|
| vanilla ingestion, no failures, ≥ N records | `catalog.metadata` (complete inventory, native types, keys, comments, view) |
| schema include/exclude filters | `filter.schema.include-one`, `filter.schema.exclude-wins` |
| table include/exclude/mix filters (filtered-count floors) | `filter.table.*` (always combined with the owned-schema filter) |
| create table + profiler | `profile.metrics` |
| system profile INSERT/MERGE/DELETE on same-named tables in two schemas (expected failure) | `profile.system` (shim) |
| auto-classification, sample rows | `classification.tags`, `sample.limit`, `sample.values.native` |
| deleted table marked deleted | `deletion.tables` |
| view lineage, 2 column edges | `lineage.view` |
| `tableDiff` data-quality test (expected failure) | `dq.table-diff` |
| profiler time partition (only checked a profile exists) | `profile.partition.time-unit` (rows outside the window must not be profiled) |
| transient tables included / excluded | `table.transient.include`, `table.transient.exclude` |
| dynamic table, stream, foreign key, clustering key | `table.dynamic`, `table.stream`, `fk.relationships`, `partition.cluster-key` |
| stored procedures and tags ingested without failures | `procedure.code`, `tags.source` (shim) |

Added beyond v1: `ingest.repeat`, `sample.values.replacement`, `sample.values.query` (a table's profile
query samples the same native values). v1's usage config builder was never called,
so usage, query-log lineage and stored-procedure lineage stay out of scope.

Snowflake reports every integer and fixed-point column as `NUMBER(p, s)`, a synonym of `DECIMAL`, and
ingestion has always stored it as `DECIMAL`. `VARIANT` and `OBJECT` are `JSON` and every `TIMESTAMP` variant is
`TIMESTAMP`, as the type parser declares for Snowflake. Table-level profile metrics come from
`INFORMATION_SCHEMA.TABLES` and describe the whole table, so a partitioned profile shows its window in
column metrics only.

Fixed while migrating, each found by a strict assertion here: Snowflake tag classifications are created
mutually exclusive (a table that sets its own value no longer also shows the schema's inherited value),
`VARIANT`, `OBJECT` and `ARRAY` samples persist as JSON instead of the driver's JSON text, samples taken
through a profile query convert through the table column types (binary values were stored as their Python
repr), and `tableDiff` resolves the table's service from the workflow's connection instead of the server's
copy, whose secrets a non-bot token reads masked.

The manually dispatched v2 workflow runs Snowflake with four workers and passes the v1 job's existing
`TEST_SNOWFLAKE_*` secrets (key pair, database and warehouse) only to its Snowflake matrix job. The v1
test drops and recreates that database for every test, so the Snowflake jobs of both workflows share the
non-cancelling concurrency group `cli-e2e-snowflake-database` and run one at a time. GitHub keeps one
pending job per group, so a third Snowflake run queued behind a pending one replaces it. Remove the v1
Snowflake test, its `py-cli-e2e-tests.yml` matrix entry and that workflow's concurrency group only after
this suite has passed for the agreed stability window.
