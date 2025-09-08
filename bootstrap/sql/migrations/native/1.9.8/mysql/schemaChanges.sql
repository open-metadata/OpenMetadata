-- Modify the path to the auto-generated operation column to extract from the JSON field
ALTER TABLE profiler_data_time_series
MODIFY COLUMN operation VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.profileData.operation') NULL;
