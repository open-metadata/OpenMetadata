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
