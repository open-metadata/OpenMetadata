-- Boost work_mem and maintenance_work_mem for the duration of this migration
-- so the hash-aggregate scan in the dedup DELETE and the index build below
-- stay in memory instead of spilling. Mirrors the tuning pattern from
-- 1.9.9/postgres/postDataMigrationSQLScript.sql (same table, same scale).
-- Session-level (not SET LOCAL) because schemaChanges runs in autocommit mode
-- (CREATE INDEX CONCURRENTLY requires it) — SET LOCAL would reset between
-- statements. RESET at the bottom restores defaults before the connection
-- returns to the Hikari pool.
SET work_mem = '256MB';
SET maintenance_work_mem = '512MB';

-- Collapse duplicates so the unique index rebuild can succeed. Single hash
-- aggregate on key columns; no-op on clean DBs.
--
-- Restricted to rows where operation IS NOT NULL (i.e. table.systemProfile —
-- the only extension that populates operation). Rationale: Postgres UNIQUE
-- treats NULLs as DISTINCT, so the constraint would have permitted
-- table.tableProfile / table.columnProfile rows (operation = NULL) that share
-- the other key columns. GROUP BY here treats NULLs as equal, so without
-- this filter we would collapse rows the constraint never blocked —
-- effectively dropping retry-induced tableProfile / columnProfile history
-- that the restored constraint will continue to permit.
DELETE FROM profiler_data_time_series p
USING (
  SELECT entityFQNHash, extension, operation, "timestamp", MAX(ctid) AS keep_ctid
  FROM profiler_data_time_series
  WHERE operation IS NOT NULL
    AND entityFQNHash IS NOT NULL
  GROUP BY entityFQNHash, extension, operation, "timestamp"
  HAVING COUNT(*) > 1
) d
WHERE p.entityFQNHash = d.entityFQNHash
  AND p.extension     = d.extension
  AND p.operation     = d.operation
  AND p."timestamp"   = d."timestamp"
  AND p.ctid <> d.keep_ctid;

-- Recover from a prior failed CREATE UNIQUE INDEX CONCURRENTLY: drop the
-- invalid leftover and rebuild inline (non-concurrent) so ALTER below
-- promotes it in the same pass. Probe scoped to OM's PDTS table.
DO $$
DECLARE
  invalid_idx oid;
BEGIN
  SELECT i.indexrelid INTO invalid_idx
  FROM pg_index i
  JOIN pg_class idx ON idx.oid = i.indexrelid
  WHERE idx.relname = 'profiler_data_time_series_unique_hash_extension_ts'
    AND i.indrelid = 'profiler_data_time_series'::regclass
    AND NOT i.indisvalid;

  IF invalid_idx IS NOT NULL THEN
    EXECUTE 'DROP INDEX ' || invalid_idx::regclass;
    EXECUTE 'CREATE UNIQUE INDEX profiler_data_time_series_unique_hash_extension_ts '
         || 'ON profiler_data_time_series '
         || '(entityFQNHash, extension, operation, "timestamp")';
  END IF;
END $$;

-- Restore the unique constraint dropped in 1.9.9. Closes the 1.9.9 regression that caused
-- /columns?fields=profile 504s, and brings Postgres back in line with MySQL (which never
-- lost it). The leading (entityFQNHash, extension) prefix serves the column-profile batch query.
-- Two-phase: CONCURRENTLY build avoids ACCESS EXCLUSIVE lock; ADD CONSTRAINT USING INDEX
-- promotes the built index without re-scanning.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
    profiler_data_time_series_unique_hash_extension_ts
    ON profiler_data_time_series (entityFQNHash, extension, operation, timestamp);

ALTER TABLE profiler_data_time_series
    ADD CONSTRAINT profiler_data_time_series_unique_hash_extension_ts
    UNIQUE USING INDEX profiler_data_time_series_unique_hash_extension_ts;

ANALYZE profiler_data_time_series;

-- Restore default memory settings before the connection returns to the pool.
RESET work_mem;
RESET maintenance_work_mem;
