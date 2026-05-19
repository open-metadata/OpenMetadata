-- Boost memory for the dedup + index build. RESET at end.
SET work_mem = '256MB';
SET maintenance_work_mem = '512MB';

-- Dedup before the unique index rebuild. NULL filter on operation: Postgres
-- UNIQUE treats NULLs as DISTINCT, so the constraint never blocked tableProfile
-- / columnProfile rows (operation = NULL). GROUP BY treats NULLs as equal —
-- without the filter we'd collapse rows the constraint never rejected.
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
-- invalid leftover and rebuild inline so ALTER below can promote it.
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

-- Reset session memory before the connection returns to the pool.
RESET work_mem;
RESET maintenance_work_mem;
