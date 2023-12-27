-- Rename customMetricsProfile to customMetrics
UPDATE profiler_data_time_series
SET json = REPLACE(json, '"customMetricsProfile"', '"customMetrics"');

-- Delete customMetricsProfile from entity_extension
-- This was not supported on the processing side before 1.3.
DELETE FROM entity_extension ee   
where extension  like '%customMetrics';

-- BEGIN: Incident Manager Migration
-- STEP 1: Update test case testCaseResult.testCaseFailureStatus field
UPDATE test_case
SET json = JSON_REMOVE(json, '$.testCaseResult.testCaseFailureStatus')
WHERE json -> '$.testCaseResult.testCaseFailureStatus' IS NOT NULL;


-- STEP 2: remove all `testCaseFailureStatus` field in test results
UPDATE data_quality_data_time_series d
SET json = JSON_REMOVE(json, '$.testCaseFailureStatus');
-- END: Incident Manager Migration

-- Test Case passed/failed row level migration
UPDATE test_definition
SET json = JSON_SET(json, '$.supportsRowLevelPassedFailed', true)
WHERE name IN (
	'columnValuesToBeUnique',
	'columnValueLengthsToBeBetween',
	'columnValuesToBeBetween',
	'columnValuesToBeInSet',
	'columnValuesToBeNotInSet',
	'columnValuesToBeNotNull',
	'columnValuesToMatchRegex',
	'columnValuesToNotMatchRegex'
);