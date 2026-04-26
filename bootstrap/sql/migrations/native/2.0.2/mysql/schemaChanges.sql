-- Restore a composite index on profiler_data_time_series(entityFQNHash, extension, timestamp).
--
-- Root cause: the 1.9.9 postDataMigrationSQLScript.sql created several temporary indexes for
-- the data migration and then dropped ALL of them at the end, including the only index that
-- covered entityFQNHash.  After that migration the table retains only the unique constraint
-- (entityFQNHash, extension, operation, timestamp) where `operation` sits between `extension`
-- and `timestamp`.  Queries of the form
--
--   SELECT entityFQNHash, MAX(timestamp) FROM profiler_data_time_series
--   WHERE entityFQNHash IN (...) AND extension = 'table.columnProfile'
--   GROUP BY entityFQNHash
--
-- cannot use that index efficiently for MAX(timestamp) because `operation` (nullable) breaks
-- the prefix.  On a large table (millions of profile rows) this causes a full table scan and
-- 100+ second response times on the columns API when `fields=profile` is requested.
--
-- The new index covers the exact predicate pattern used by getLatestExtensionsBatch().
CREATE INDEX IF NOT EXISTS idx_pdts_fqnhash_ext_ts
    ON profiler_data_time_series (entityFQNHash, extension, timestamp);
