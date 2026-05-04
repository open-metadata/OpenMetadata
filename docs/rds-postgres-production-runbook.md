# OpenMetadata on AWS RDS PostgreSQL — Production Runbook

Consolidates every change applied during the 600k-container `storage_container_entity`
investigation against `saas-relationsdbg-blue` (Postgres 17, eu-west-2) into a single
runbook for any RDS instance running OpenMetadata at scale.

The work splits into four buckets:

1. **RDS instance parameter group** — server-side knobs (reboot or apply-immediate)
2. **Postgres extensions** — must be enabled after the parameter-group reboot
3. **Per-table autovacuum overrides** — applied with `ALTER TABLE`
4. **Indexes** — what's already in `bootstrap/sql/migrations/native/1.13.0`, and what
   must be applied **by hand** because the runner can't ship it cross-version

---

## 1. RDS Instance Parameter Group

Create a new **custom DB parameter group** for the engine version (don't edit the
default; default groups are read-only and can't be modified). Then apply it to the
instance and reboot once for the rebootable params to take effect.

### Memory & planner

| Parameter | Value | Apply | Notes |
|---|---|---|---|
| `shared_buffers` | `{DBInstanceClassMemory*40/100}` | **reboot** | Use the formula form, not a hex/byte literal. RDS converts it to 8 kB pages internally. We hit a `shared_buffers value exceeded available system memory` ALARM on May 1 because a literal value was used — RDS auto-clamps but the instance won't start. |
| `effective_cache_size` | `{DBInstanceClassMemory*3/4}` | dynamic | **Use the formula, not a literal.** A literal `24610937856` failed startup with `invalid value for parameter "effective_cache_size": "24610937856"; Value exceeds integer range` — the parameter is `int` and overflows past ~16 GB when expressed in 8 kB pages. The formula form is computed safely. |
| `work_mem` | `131072` (128 MB, kB units) | dynamic | Per sort. Listings with `ORDER BY name, id LIMIT N` were spilling to disk on the 4 MB default. |
| `maintenance_work_mem` | `2097152` (2 GB, kB units) | dynamic | Used by `CREATE INDEX` / `VACUUM` / `ANALYZE`. Cuts index-build time 5-10×. |
| `random_page_cost` | `1.1` | dynamic | gp3 / io1 SSD. Default `4.0` was tuned for spinning disks and biases the planner against index scans. |
| `effective_io_concurrency` | `200` | dynamic | Lets bitmap heap scans issue parallel I/O on SSD. |
| `max_parallel_workers_per_gather` | `4` | dynamic | Doubles parallelism for the seq scans the planner still picks. |
| `max_parallel_workers` | `8` | dynamic | Pool feeding the above. |
| `max_worker_processes` | `16` | **reboot** | Cap; must be ≥ `max_parallel_workers`. |

### Autovacuum

| Parameter | Value | Apply |
|---|---|---|
| `autovacuum_naptime` | `15s` | dynamic |
| `autovacuum_max_workers` | `6` | **reboot** |
| `autovacuum_vacuum_scale_factor` | `0.05` | dynamic |
| `autovacuum_analyze_scale_factor` | `0.02` | dynamic |
| `autovacuum_vacuum_insert_scale_factor` | `0.1` | dynamic |
| `autovacuum_vacuum_cost_limit` | `2000` | dynamic |
| `autovacuum_vacuum_cost_delay` | `2` (ms) | dynamic |

### Diagnostics (extensions, log_*, auto_explain)

| Parameter | Value | Apply | Notes |
|---|---|---|---|
| `shared_preload_libraries` | `pg_stat_statements,auto_explain` | **reboot** | One-time. After reboot, run `CREATE EXTENSION` (next section). |
| `pg_stat_statements.track` | `all` | dynamic | |
| `pg_stat_statements.max` | `5000` | dynamic | |
| `auto_explain.log_min_duration` | `500` | dynamic | ms |
| `auto_explain.log_analyze` | `1` | dynamic | |
| `auto_explain.log_buffers` | `1` | dynamic | |
| `auto_explain.log_format` | `json` | dynamic | |
| `auto_explain.log_nested_statements` | `1` | dynamic | |
| `log_min_duration_statement` | `1000` | dynamic | ms |
| `log_lock_waits` | `1` | dynamic | |
| `log_temp_files` | `10240` | dynamic | bytes |
| `log_autovacuum_min_duration` | `1000` | dynamic | ms |
| `log_checkpoints` | `1` | dynamic | |

### Verifying the parameter group took

```sql
SELECT name,
       setting,
       unit,
       CASE
         WHEN unit IN ('8kB','kB') AND setting ~ '^[0-9]+$'
           THEN pg_size_pretty(setting::bigint *
                  CASE unit WHEN '8kB' THEN 8192 WHEN 'kB' THEN 1024 END)
         ELSE NULL
       END AS human_size,
       source
FROM pg_settings
WHERE name IN (
  'shared_buffers','effective_cache_size','work_mem','maintenance_work_mem',
  'random_page_cost','effective_io_concurrency','max_parallel_workers_per_gather',
  'max_connections')
ORDER BY name;
```

Expect `source = 'configuration file'` for every row that was overridden. If you
see `'default'`, the parameter group isn't actually attached or the apply
hasn't propagated yet.

---

## 2. Extensions (post-reboot)

Run as the `openmetadata` DB owner after the reboot has finished:

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_prewarm;
CREATE EXTENSION IF NOT EXISTS pgstattuple;
CREATE EXTENSION IF NOT EXISTS pg_repack;
```

`pg_trgm` is already required by 1.11.0 migrations and gets created automatically.

---

## 3. Per-table autovacuum overrides

These tighten autovacuum thresholds for the specific tables that drive
OpenMetadata's hot read path. Apply once; they persist with the table.

```sql
-- Entity-table set with the most concentrated traffic
ALTER TABLE storage_container_entity SET (autovacuum_analyze_scale_factor = 0.01, autovacuum_vacuum_scale_factor = 0.02);
ALTER TABLE table_entity              SET (autovacuum_analyze_scale_factor = 0.01, autovacuum_vacuum_scale_factor = 0.02);
ALTER TABLE dashboard_entity          SET (autovacuum_analyze_scale_factor = 0.01, autovacuum_vacuum_scale_factor = 0.02);
ALTER TABLE pipeline_entity           SET (autovacuum_analyze_scale_factor = 0.01, autovacuum_vacuum_scale_factor = 0.02);
ALTER TABLE database_entity           SET (autovacuum_analyze_scale_factor = 0.02, autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE database_schema_entity    SET (autovacuum_analyze_scale_factor = 0.02, autovacuum_vacuum_scale_factor = 0.05);

-- entity_relationship: the JOIN target, write-heavy
ALTER TABLE entity_relationship SET (
    autovacuum_analyze_scale_factor = 0.005,
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_vacuum_cost_limit = 4000);

-- tag_usage: the hottest table (30 GB on the audited tenant)
ALTER TABLE tag_usage SET (
    autovacuum_analyze_scale_factor = 0.005,
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_vacuum_cost_limit = 4000,
    autovacuum_vacuum_cost_delay = 0);

-- change_event: append-only-ish, less aggressive
ALTER TABLE change_event SET (
    autovacuum_analyze_scale_factor = 0.1,
    autovacuum_vacuum_scale_factor = 0.2);
```

Verify:

```sql
SELECT relname, reloptions
FROM pg_class
WHERE relname IN ('storage_container_entity','table_entity','dashboard_entity',
                  'pipeline_entity','database_entity','database_schema_entity',
                  'entity_relationship','tag_usage','change_event')
ORDER BY relname;
```

---

## 4. Indexes

This is the part that needs care. Every index change since 1.8.2 lives in one of
the `bootstrap/sql/migrations/native/<version>/postgres/schemaChanges.sql` files
and is applied by the OpenMetadata native migration runner on deploy. A few
critical indexes are **not yet shipped** and have to be applied by hand on
production tenants — flagged below.

### 4a. Shipped in 1.13.0 (run automatically on next deploy)

From `bootstrap/sql/migrations/native/1.13.0/postgres/schemaChanges.sql`:

- `idx_er_fromentity_toentity_relation_toid` on `entity_relationship(fromEntity, toEntity, relation, toId)`
  - Covers the `NOT EXISTS` anti-join used by `ContainerDAO` `?root=true` listings.
  - PR #27858 (commit `ecc4b17579`).

- `idx_<table>_fqnhash_pattern` `varchar_pattern_ops` indexes on `fqnHash` for **24 entity tables**
  - Tables: `chart_entity`, `dashboard_entity`, `dashboard_data_model_entity`, `database_entity`, `database_schema_entity`, `glossary_term_entity`, `ingestion_pipeline_entity`, `metric_entity`, `ml_model_entity`, `policy_entity`, `query_entity`, `report_entity`, `search_index_entity`, `storage_container_entity`, `table_entity`, `test_case`, `topic_entity`, `api_collection_entity`, `api_endpoint_entity`, `directory_entity`, `file_entity`, `spreadsheet_entity`, `worksheet_entity` (24 total — `pipeline_entity` excluded by design; it uses an EXISTS join, not a `LIKE` prefix).
  - Each uses `CREATE INDEX CONCURRENTLY IF NOT EXISTS` — no write lock during the build.
  - Speeds up `?service=` / `?database=` / `?databaseSchema=` / `?parent=` / `?apiCollection=` / `?spreadsheet=` / `?testSuite=` listings (`fqnHash LIKE 'prefix%'`) by switching the cold count(*) plan from parallel seq scan to bitmap index scan. Storage_container went from ~3s to tens of ms.
  - PR #27868 (commit `b118a87df2`).
  - **MySQL is unaffected** — `fqnHash` already uses `ascii_bin` collation, so the existing unique B-tree handles `LIKE 'prefix%'` natively.

#### Operator runbook for `CONCURRENTLY` builds (Postgres only)

If a `CREATE INDEX CONCURRENTLY` is interrupted (deploy timeout, lock contention, OOM,
connection drop), Postgres leaves an **INVALID** index behind and `IF NOT EXISTS`
silently skips the rebuild on retry. Detection:

```sql
SELECT c.relname FROM pg_class c
JOIN pg_index i ON i.indexrelid = c.oid
WHERE NOT i.indisvalid
  AND c.relname LIKE 'idx\_%\_fqnhash\_pattern' ESCAPE '\';
```

Remediation per row:

```sql
DROP INDEX CONCURRENTLY <relname>;
DELETE FROM server_migration_sql_logs
 WHERE version = '1.13.0'
   AND sqlstatement LIKE '%idx\_<table>\_fqnhash\_pattern%' ESCAPE '\';
```

### 4b. **NOT shipped** in 1.13.0 — apply by hand on production

The `idx_<entity>_deleted_name_id` indexes were originally shipped in **1.8.2**.
Audit on the production RDS showed only **9 of 20** entity tables had them
applied — meaning 1.8.2 partially failed on this tenant, and the legacy
`(fqnHash, deleted)` indexes from 1.4.0 were never dropped.

PR #27859 attempted to ship a verbatim re-apply in 1.13.0 (commit `0a5e54c201`),
but the migration runner's parse-time hash dedup (`SERVER_MIGRATION_SQL_LOGS`)
**doesn't work cross-version**: it's populated as each version executes, but
`parseSQLFiles` is called for every version up front, before any version runs.
On a fresh DB the 1.13.0 statements collide with the 1.8.2 ones moments later
("Duplicate key name" / "already exists") and the IT bootstrap fails. The
re-apply was reverted in commit `d3d3796339`.

So **production tenants must run the following SQL manually**, exactly once,
after the deploy. It is idempotent (`IF NOT EXISTS` on Postgres):

```sql
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'api_collection_entity','api_endpoint_entity','chart_entity',
    'dashboard_data_model_entity','dashboard_entity','data_contract_entity',
    'database_entity','database_schema_entity','glossary_term_entity',
    'ingestion_pipeline_entity','metric_entity','ml_model_entity',
    'pipeline_entity','policy_entity','report_entity','search_index_entity',
    'storage_container_entity','stored_procedure_entity','table_entity',
    'topic_entity','user_entity','team_entity','glossary_entity']
  LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%s_deleted_name_id ON %I (deleted, name, id)', t, t);
  END LOOP;
END $$;
```

Detection — check which tables are missing the index before running:

```sql
SELECT t.tablename,
       EXISTS (
         SELECT 1 FROM pg_indexes
         WHERE schemaname = current_schema()
           AND indexname = 'idx_' || t.tablename || '_deleted_name_id'
       ) AS has_index
FROM (VALUES
  ('api_collection_entity'),('api_endpoint_entity'),('chart_entity'),
  ('dashboard_data_model_entity'),('dashboard_entity'),('data_contract_entity'),
  ('database_entity'),('database_schema_entity'),('glossary_term_entity'),
  ('ingestion_pipeline_entity'),('metric_entity'),('ml_model_entity'),
  ('pipeline_entity'),('policy_entity'),('report_entity'),('search_index_entity'),
  ('storage_container_entity'),('stored_procedure_entity'),('table_entity'),
  ('topic_entity'),('user_entity'),('team_entity'),('glossary_entity')
) AS t(tablename)
ORDER BY has_index, t.tablename;
```

Caveats (read before running):

- **`stored_procedure_entity`**: 1.10.0 intentionally **dropped** `idx_stored_procedure_entity_deleted_name_id` and replaced it with `idx_stored_procedure_schema_listing(deleted, databaseSchemaHash, name, id)`. Re-creating the dropped index is harmless (extra ~tens of MB) but redundant. Drop it from the loop if you want to be strict.
- **`user_entity`, `team_entity`, `glossary_entity`**: 1.8.2 created these as `(deleted, name)`. The DO block above creates `(deleted, name, id)`. Both serve the same listings; the 3-column form is mildly preferable. If 1.8.2 already ran for these three on the tenant, the `IF NOT EXISTS` will skip them — leaving the 2-column form in place, which is still fine.
- **`idx_er_toid_toentity_relation`** (mentioned in the original Slack thread):
  do **NOT** create this. It's functionally identical to `idx_entity_relationship_to_type_relation`
  on `(toId, toEntity, relation)` already shipped in 1.9.5 and present on production
  (verified by `pg_indexes` against `entity_relationship`). Creating both wastes ~tens of MB
  and slows writes; pick one. The one that's there is fine.

### 4c. Older entity_relationship indexes (verify they're present)

These come from prior version migrations and should already be in place on any
tenant that successfully ran 1.9.x and 1.11.x. Worth a sanity check:

| Index | Source migration | Definition |
|---|---|---|
| `idx_entity_relationship_to_type_relation` | 1.9.5 | `(toId, toEntity, relation)` |
| Composite from 1.9.0 | 1.9.0 | `(fromId, fromEntity, toId, toEntity, relation)` |
| `idx_entity_relationship_from_deleted` | 1.11.0 | `(fromId, fromEntity, relation) INCLUDE (toId, toEntity, relation) WHERE deleted = FALSE` |
| `idx_entity_relationship_to_deleted` | 1.11.0 | `(toId, toEntity, relation) INCLUDE (fromId, fromEntity, relation) WHERE deleted = FALSE` |
| `idx_entity_relationship_from_typed` | 1.11.0 | `(toId, toEntity, relation, fromEntity) WHERE deleted = FALSE` |
| `idx_entity_relationship_bidirectional` | 1.11.0 | `(fromId, toId, relation) WHERE deleted = FALSE` |

Quick check:

```sql
SELECT indexname FROM pg_indexes
WHERE schemaname = current_schema()
  AND tablename = 'entity_relationship'
ORDER BY indexname;
```

### 4d. tag_usage indexes (1.11.0 — verify, this is the 30 GB / 7.4 M-row table)

These all use `CREATE INDEX CONCURRENTLY IF NOT EXISTS`, so a missing one
doesn't block the migration runner — but it does silently degrade perf. The
audit on production showed all 12 present and `idx_tag_usage_target_exact`
covering the certification path with the right INCLUDE (so PR #27847's batch
query change can use it). Worth verifying once on any new RDS:

```sql
SELECT s.indexrelname, pg_size_pretty(pg_relation_size(s.indexrelid)) AS size, s.idx_scan
FROM pg_stat_user_indexes s
WHERE s.relname = 'tag_usage'
ORDER BY s.indexrelname;
```

Expect: `gin_tag_usage_targetfqn_trgm`, `idx_tag_usage_join_source`, `idx_tag_usage_source_target`, `idx_tag_usage_tag_fqn_hash`, `idx_tag_usage_target_exact`, `idx_tag_usage_target_fqn_hash`, `idx_tag_usage_target_prefix_covering`, `idx_tag_usage_target_source`, `idx_tag_usage_targetfqnhash_lower_pattern`, `idx_tag_usage_tagfqn_lower_pattern`, `idx_tag_usage_tagfqn_prefix_covering`, plus the `tag_usage_source_tagfqnhash_targetfqnhash_key` unique constraint (12 entries total).

---

## 5. Smoke checks after everything is applied

```sql
-- 1. Cache hit rates on the hot tables — should all be ≥99%.
SELECT relname,
       heap_blks_read, heap_blks_hit,
       ROUND(100.0 * heap_blks_hit / NULLIF(heap_blks_hit + heap_blks_read, 0), 2) AS cache_hit_pct
FROM pg_statio_user_tables
WHERE relname IN ('storage_container_entity','entity_relationship','tag_usage','table_entity','tag_usage')
ORDER BY heap_blks_read DESC;

-- 2. Count(*) against a service-filtered listing — should be tens of ms,
--    not seconds. Replace <serviceFqnHashPrefix> with a real prefix from
--    the tenant.
EXPLAIN (ANALYZE, BUFFERS) SELECT count(*)
FROM storage_container_entity
WHERE deleted = FALSE
  AND fqnHash LIKE 'd34d...%';

-- 3. ?root=true container listing — should use the new
--    idx_er_fromentity_toentity_relation_toid covering index.
EXPLAIN (ANALYZE, BUFFERS) SELECT count(*)
FROM storage_container_entity sc
WHERE sc.deleted = FALSE
  AND NOT EXISTS (
    SELECT 1 FROM entity_relationship er
    WHERE er.fromEntity = 'container'
      AND er.toEntity = 'container'
      AND er.relation = 0
      AND er.toId = sc.id
  );

-- 4. Sizes & row counts of the big tables (sanity)
SELECT relname,
       pg_size_pretty(pg_total_relation_size(relid)) AS total,
       pg_size_pretty(pg_relation_size(relid)) AS heap,
       pg_size_pretty(pg_indexes_size(relid)) AS idx,
       n_live_tup
FROM pg_stat_user_tables
WHERE relname IN ('storage_container_entity','entity_relationship','tag_usage')
ORDER BY pg_total_relation_size(relid) DESC;
```

---

## 6. PRs / commits this runbook consolidates

| PR | Commit | What it added |
|---|---|---|
| #27858 | `ecc4b17579` | Redis caching for container ancestors + `/children` page; `idx_er_fromentity_toentity_relation_toid` |
| #27859 | `bf23776721` | `ListCountCache` for `?limit=1`-style total queries; ContainerDAO `?root=true` `NOT EXISTS` rewrite. The 1.8.2 reapply piece of this PR was reverted (`d3d3796339`) — ship by hand per §4b. |
| #27864 | `620d1b6ad9` | Tag-rename + relationship invalidation; bundle warmup app |
| #27865 | `5620121e50` | Tunable search-index settings + per-stage latency metrics. Adds `readerTimeMs` / `processTimeMs` / `sinkTimeMs` / `vectorTimeMs` columns to `search_index_server_stats` (1.13.0). |
| #27868 | `b118a87df2` | `varchar_pattern_ops` `fqnHash` indexes for 24 entity tables (Postgres-only) |
| #27836 | `ad9e1b7823` | Batch derived-tag fetch on container data-model columns (N→1 query) |
| #27847 | `4a2f42f1d3` | `tag_usage` cert query: add `source` filter + indexed hash prefix; ~12s → tens of ms |
| #27828 | `75c3ad2e67` | Owner-search retry not hanging on container detail pages (Playwright fix) |

## 7. Lessons from the May 1 RDS reboot incident

When applying this parameter group to a new RDS instance:

1. **Use formula form for memory params** (`{DBInstanceClassMemory*40/100}`),
   never literal byte values. RDS' auto-clamp on `shared_buffers` will leave
   the instance unable to start because the clamped value is outside the
   acceptable range.

2. **`effective_cache_size` is `int`, not `bigint`** at the parameter level.
   A literal `24610937856` (~24 GB) overflows. The formula form is computed
   in 8 kB pages internally so it doesn't overflow on instance classes up to
   tens of GB of RAM.

3. **Apply the parameter group to the experimentation instance only** until
   it's verified to start. Then promote to prod. We accidentally pointed the
   blue (prod) instance at the new group on the first attempt — the mistake
   was caught before traffic was affected, but the recovery (revert to old
   group + reboot) cost ~15 minutes.

4. **Read the Postgres error log on parameter-group failures**:
   `https://<region>.console.aws.amazon.com/rds/home?region=<region>#log-details:id=<instance>;log=error/postgres.log;type=view`.
   The "instance won't start" RDS event is generic; the actual offending
   parameter is only visible in the postgres.log line that says
   `invalid value for parameter "..."`.
