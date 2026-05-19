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

-- Recovery guard: in-place rebuild of any leftover INVALID index from a
-- prior failed CREATE UNIQUE INDEX CONCURRENTLY attempt.
--
-- Why this exists: CREATE UNIQUE INDEX CONCURRENTLY aborts when it hits
-- existing duplicate keys but leaves indisvalid=false behind. On a later
-- migration retry, IF NOT EXISTS no-ops (the name is taken) and the
-- statement gets checksum-logged as successful — after which ADD
-- CONSTRAINT USING INDEX fails permanently with "index ... is not valid".
--
-- Why the work is inline (not a "clear the log and re-run" pattern):
-- MigrationFile.parseSQLFiles filters already-logged statements at parse
-- time, before any statement executes. So clearing the log inside this
-- block does not bring the original CREATE statement back into this
-- pass's execution list — it would only re-run on the next migration
-- cycle, leaving the same-pass ALTER to fail again. Instead, we rebuild
-- the index inline (non-concurrent, brief ACCESS EXCLUSIVE on this
-- table) so a valid index exists before the ALTER statement runs in this
-- same pass. The lock cost is acceptable because this path fires only
-- when the environment is already in a degraded state.
--
-- The probe is anchored via i.indrelid = 'profiler_data_time_series'::regclass
-- so an unrelated invalid index of the same name in a different schema
-- cannot trigger this branch. The DROP targets the specific index by OID.
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
