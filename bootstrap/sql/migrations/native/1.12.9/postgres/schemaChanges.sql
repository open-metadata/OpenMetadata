-- Recovery guard: drop any leftover INVALID index from a prior failed
-- CREATE UNIQUE INDEX CONCURRENTLY attempt, and clear its migration-log
-- entry so the CREATE statement below re-runs and rebuilds a clean index.
-- CREATE UNIQUE INDEX CONCURRENTLY aborts when it hits existing duplicate
-- keys but leaves indisvalid=false behind; a later migration retry no-ops
-- on IF NOT EXISTS and gets logged as successful, after which ADD
-- CONSTRAINT USING INDEX fails permanently with "index ... is not valid".
-- The guard fires only when an invalid index is present, so it is a true
-- no-op on fresh databases and on already-migrated environments.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_index i ON i.indexrelid = c.oid
    WHERE c.relname = 'profiler_data_time_series_unique_hash_extension_ts'
      AND NOT i.indisvalid
  ) THEN
    EXECUTE 'DROP INDEX profiler_data_time_series_unique_hash_extension_ts';
    DELETE FROM server_migration_sql_logs
    WHERE version = '1.12.9'
      AND sqlstatement LIKE '%CREATE UNIQUE INDEX%profiler_data_time_series_unique_hash_extension_ts%';
  END IF;
END $$;

-- Collapse duplicate rows on the unique key so the CREATE UNIQUE INDEX
-- below can succeed. Duplicates accumulated on Postgres only, during the
-- 1.9.9 -> 1.12.9 window where the constraint was missing and the
-- time-series sink uses plain INSERT (no ON CONFLICT). On multi-million-
-- row tables the subquery is a single hash aggregate on key columns (no
-- json read); the outer DELETE only touches rows in duplicate groups, so
-- on clean DBs it is a no-op.
DELETE FROM profiler_data_time_series p
USING (
  SELECT entityFQNHash, extension, operation, "timestamp", MAX(ctid) AS keep_ctid
  FROM profiler_data_time_series
  GROUP BY entityFQNHash, extension, operation, "timestamp"
  HAVING COUNT(*) > 1
) d
WHERE p.entityFQNHash = d.entityFQNHash
  AND p.extension     = d.extension
  AND p.operation     = d.operation
  AND p."timestamp"   = d."timestamp"
  AND p.ctid <> d.keep_ctid;

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
