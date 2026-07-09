# BigQuery & Redshift progress totals — design

## Goal

Give the BigQuery and Redshift connectors the same up-front progress denominators
that Snowflake already declares, so an ingestion run renders an accurate `%` and
ETA for the `Database` and `DatabaseSchema` levels instead of a denominator-less
"processed N" counter.

Both connectors reach **full Snowflake-parity**: `Database` total set up front,
and per-database `DatabaseSchema` totals seeded from a single cheap enumeration —
no per-database reconnects.

## Background — the existing pattern

Progress totals are declared through one optional connector hook on
`TopologyRunnerMixin`:

```python
def declare_progress_totals(self, totals: TotalsDeclarer) -> None: ...
```

Facts about the hook (from `progress/runner_tracker.py` and `api/topology_runner.py`):

- Called **exactly once**, lazily, on the first real (non-root) node — *after* the
  service root has populated `self.context`, so `context.get().database_service`
  and connection/inspector state are available.
- Only fires for `progress_mode = ProgressMode.AUTO` sources (the default). Both
  BigQuery and Redshift are AUTO.
- Wrapped in try/except by `_declare_totals_once`: a failure here **warns and
  continues** with denominator-less progress — it never aborts the walk. Totals
  are a progress-only enhancement.

`TotalsDeclarer` (denominator-only facade — cannot increment processed counts)
exposes:

- `set_total(entity_type, n)` — the run-level total for a level.
- `seed_scope_total(entity_type, scope, n)` — a per-scope sub-total, e.g. the
  schema count *within one database*.
- `mark_reconcilable(entity_type)` — "I can't pre-count this; build the total
  from observed scope counts during the walk."

**Reference implementations:**

- **Snowflake** (`snowflake/metadata.py`): sets `Database` total from the filtered
  DB list; runs one account-wide `SHOW SCHEMAS` (`SNOWFLAKE_GET_SCHEMATA`), groups
  results by `database_name`, applies a **filter-only** schema check
  (`_is_schema_filtered`, no status side-effects), and calls `seed_scope_total`
  per database. If the account SHOW fails it `mark_reconcilable`s the schema level.
- **MySQL** (`mysql/metadata.py`): sets `Database` total; `mark_reconcilable`s
  `DatabaseSchema` because MySQL only exposes schemas through the live per-DB
  inspector.

The two connectors here follow the **Snowflake** shape.

## Design

### BigQuery

`BigquerySource(LifeCycleQueryMixin, CommonDbSourceService, MultiDBSource)`.

- **Databases** are `self.project_ids` — an in-memory list built in `__init__`
  (`set_project_id`). Cheap; no I/O.
- **Schemas** are datasets, enumerated per project via `self.client.list_datasets(project)`.

**`declare_progress_totals`:**

1. Compute the filtered project list by reusing the same `filter_by_database`
   logic that `get_database_names` applies (FQN vs bare name per
   `useFqnForFiltering`), **without** the status side-effects and inspector setup
   in `get_database_names`. Extract a small filter-only helper
   (e.g. `_is_database_filtered(project_id)`) and use it from both the totals hook
   and, ideally, `get_database_names` to avoid divergence.
2. `totals.set_total(Database.__name__, len(filtered_projects))`.
3. For each filtered project: list its datasets and count those that pass a
   **filter-only** schema check. The existing `_get_filtered_datasets(project_id)`
   already returns datasets passing `filter_by_schema` — but it calls
   `get_raw_database_schema_names()` which reads `self.context.get().database`,
   and it is context-dependent. Introduce/extend a context-free variant that takes
   the explicit `project_id` (mirrors Snowflake's `_is_schema_filtered(db, schema)`),
   so the count matches what the walk will actually ingest.
   Then `totals.seed_scope_total(DatabaseSchema.__name__, project_id, count)`.

**Notes / caveats:**

- `list_datasets` is the same API call the walk makes; calling it once more here
  for counting is acceptable (BigQuery client responses are paged/cheap relative
  to table ingestion). We are **not** adding a cache — the call is bounded by the
  project count.
- If `service_connection.databaseSchema` is configured (single-dataset mode),
  `get_raw_database_schema_names` yields just that one schema; the count naturally
  reflects it.
- Incremental side-effects (`_prepare_schema_incremental_data`,
  `incremental_table_processor`) must **not** run inside the totals path — the
  filter-only helper enumerates and filters names only.

### Redshift

`RedshiftSource(ExternalTableLineageMixin, LifeCycleQueryMixin, CommonDbSourceService, MultiDBSource)`.

- **Databases**: single configured DB when `ingestAllDatabases=false`
  (`get_configured_database`), otherwise the filtered result of
  `REDSHIFT_GET_DATABASE_NAMES` (`SELECT datname FROM pg_database`).
- **Schemas**: today enumerated via the per-DB SQLAlchemy inspector
  (`pg_namespace` / external schemas), which would require a reconnect per
  database. **Instead** we add one cross-database query.

**New query — `REDSHIFT_GET_ALL_SCHEMAS`** in `redshift/queries.py`:

```sql
SELECT database_name, schema_name
FROM SVV_ALL_SCHEMAS
```

`SVV_ALL_SCHEMAS` returns the union of native (`SVV_REDSHIFT_SCHEMAS`) and external
Spectrum schemas across **all** databases the connection can see, with a
`database_name` column — the direct analog of Snowflake's account-wide SHOW. One
round-trip on the existing connection, no reconnect.

**`declare_progress_totals`:**

1. Compute the filtered database list:
   - `ingestAllDatabases=false` → `[get_configured_database()]`.
   - else → `get_database_names_raw()` filtered by the same `filter_by_database`
     logic as `get_database_names`, **filter-only** (no `status.filter` side-effect,
     no inspector/incremental setup). Extract a `_is_database_filtered(db)` helper
     shared with `get_database_names`.
2. `totals.set_total(Database.__name__, len(filtered_dbs))`.
3. Run `REDSHIFT_GET_ALL_SCHEMAS`, group `schema_name` by `database_name`,
   restricted to the filtered DB set (and to the single connected DB when
   `ingestAllDatabases=false`).
4. For each filtered DB, count schemas passing a **filter-only** schema check
   (FQN vs bare per `useFqnForFiltering`, mirroring Snowflake's `_is_schema_filtered`),
   and `totals.seed_scope_total(DatabaseSchema.__name__, db, count)`.

**Fallback:** wrap the `SVV_ALL_SCHEMAS` query in try/except. On any failure
(view unavailable on an older cluster, role lacks privilege, serverless quirk),
log a warning and `totals.mark_reconcilable(DatabaseSchema.__name__)` — the runner
then fills the schema total from what it observes during the walk. This mirrors
Snowflake's degradation when its account SHOW fails, and keeps the whole hook
best-effort on top of the runner's own try/except.

## Components / touch points

| File | Change |
|---|---|
| `redshift/queries.py` | Add `REDSHIFT_GET_ALL_SCHEMAS` constant. |
| `redshift/metadata.py` | Add `declare_progress_totals`; add filter-only `_is_database_filtered` / `_is_schema_filtered` helpers; import `TotalsDeclarer`, `Database`, `DatabaseSchema`. |
| `bigquery/metadata.py` | Add `declare_progress_totals`; add filter-only database/schema helpers (or a context-free dataset-count helper); import `TotalsDeclarer`. |

No changes to the progress package, topology runner, or schemas — the hook and
facades already exist.

## Error handling

- The whole hook is already best-effort (runner's `_declare_totals_once`
  try/except). We add a **narrower** try/except around the Redshift
  `SVV_ALL_SCHEMAS` query specifically so a schema-enumeration failure degrades to
  `mark_reconcilable` (partial totals: DB total still set) rather than dropping
  *all* totals for the run.
- Filter-only helpers must not emit `status.filter(...)` — the real
  `get_database_names` / `_get_filtered_schema_names` own the status side-effects
  during the walk, and running them twice would double-count filtered entities in
  the status report.

## Testing

Follow the project's Python testing rules (pytest, plain `assert`, mocks only at
boundaries).

- **BigQuery** (`ingestion/tests/unit/topology/database/test_bigquery.py` or a new
  progress test): mock `client.list_datasets` to return N datasets across M
  projects; assert `declare_progress_totals` calls `set_total(Database, M)` and
  `seed_scope_total(DatabaseSchema, project, n)` per project, honoring
  `databaseFilterPattern` / `schemaFilterPattern`.
- **Redshift** (`ingestion/tests/unit/topology/database/test_redshift.py`): stub the
  `SVV_ALL_SCHEMAS` result set; assert per-DB `seed_scope_total`; assert that a
  raised exception from the query path results in `mark_reconcilable(DatabaseSchema)`
  and a still-correct `set_total(Database, ...)`.
- Use a fake/spy `TotalsDeclarer` (or a real one over a stub registry) and assert on
  the recorded totals — test the **outcome** (declared denominators), not internal
  call wiring.

## Out of scope

- No changes to how tables/columns are counted (leaf-level progress already works
  via the runner).
- No new caching layer (dataset/schema listings are bounded by DB/project count).
- No live-cluster verification of `SVV_ALL_SCHEMAS` in CI — the try/except fallback
  covers environments where the assumption doesn't hold; column names should be
  sanity-checked against a real cluster before merge.
