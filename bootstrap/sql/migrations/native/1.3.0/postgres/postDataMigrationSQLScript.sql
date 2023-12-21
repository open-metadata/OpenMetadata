-- Rename customMetricsProfile to customMetrics
UPDATE profiler_data_time_series
SET json = REPLACE(json::text, '"customMetricsProfile"', '"customMetrics"')::jsonb;

-- Delete customMetricsProfile from entity_extension
-- This was not supported on the processing side before 1.3.
DELETE FROM entity_extension ee   
where extension  like '%customMetrics';

-- Test Case passed/failed row level migration
UPDATE test_definition
SET json = JSONB_SET(json, '{supportsRowLevelPassedFailed}', 'true', true)
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