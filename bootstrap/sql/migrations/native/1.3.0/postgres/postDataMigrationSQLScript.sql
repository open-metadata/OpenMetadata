-- Rename customMetricsProfile to customMetrics
UPDATE profiler_data_time_series
SET json = REPLACE(json::text, '"customMetricsProfile"', '"customMetrics"')::jsonb;

-- Delete customMetricsProfile from entity_extension
-- This was not supported on the processing side before 1.3.
DELETE FROM entity_extension ee   
where extension  like '%customMetrics';

-- BEGIN: Incident Manager Migration
-- STEP 1: Update test case testCaseResult.testCaseFailureStatus field
UPDATE test_case
SET json = json::jsonb#-'{testCaseResult,testCaseFailureStatus}';
-- STEP 2: remove all `testCaseFailureStatus` field in test results
UPDATE data_quality_data_time_series d
SET json = json::jsonb#-'{testCaseFailureStatus}';
-- END: Incident Manager Migration