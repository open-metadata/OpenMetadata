-- Modify the path to the auto-generated operation column to extract from the JSON field
-- 1. Drop the unique constraint first
ALTER TABLE profiler_data_time_series
DROP CONSTRAINT IF EXISTS profiler_data_time_series_unique_hash_extension_ts;
-- 2. Drop the generated column
ALTER TABLE profiler_data_time_series
DROP COLUMN operation;
-- 3. Add the column back with new expression
ALTER TABLE profiler_data_time_series
ADD COLUMN operation VARCHAR(256) GENERATED ALWAYS AS (json -> 'profileData' ->> 'operation') STORED;
