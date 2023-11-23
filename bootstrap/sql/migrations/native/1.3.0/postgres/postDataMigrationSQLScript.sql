-- Rename customMetricsProfile to customMetrics
UPDATE profiler_data_time_series
SET json = REPLACE(json::text, '"customMetricsProfile"', '"customMetrics"')::jsonb;

-- Delete customMetricsProfile from entity_extension
-- This was not supported on the processing side before 1.3.
DELETE FROM entity_extension ee   
where extension  like '%customMetrics';