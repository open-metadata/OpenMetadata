-- Rename customMetricsProfile to customMetrics
UPDATE profiler_data_time_series
SET json = REPLACE(json, '"customMetricsProfile"', '"customMetrics"');

-- Delete customMetricsProfile from entity_extension
-- This was not supported on the processing side before 1.3.
DELETE FROM openmetadata_db.entity_extension ee   
where extension  like '%customMetrics';

-- BEGIN: Incident Manager Migration
-- STEP 1: Update test case testCaseResult.testCaseFailureStatus field
UPDATE test_case tc
INNER JOIN test_case_resolution_status_time_series tcrsts ON tc.id = tcrsts.json ->> '$.testCaseReference.id'
SET tc.json = JSON_SET(
	JSON_REMOVE(tc.json, '$.testCaseResult.testCaseFailureStatus'),
	'$.testCaseResult.testCaseResolutionStatusReference',
	tcrsts.json
)
WHERE tc.json -> '$.testCaseResult.testCaseFailureStatus' IS NOT NULL;


-- STEP 2: remove all `testCaseFailureStatus` field in test results
UPDATE data_quality_data_time_series d
SET json = JSON_REMOVE(json, '$.testCaseFailureStatus');

-- STEP 3: update latest test case result with new res. status
UPDATE data_quality_data_time_series exisiting_dq_result
INNER JOIN (
	SELECT
		resolution.json,
		ranked_dq_result.timestamp,
		ranked_dq_result.entityFQNHash -- test case FQN Hash
	FROM (
		SELECT
			ROW_NUMBER() OVER(PARTITION BY entityFQNHash ORDER BY `timestamp` DESC) AS row_num,
			json,
			entityFQNHash,
			`timestamp`
		FROM data_quality_data_time_series
	) ranked_dq_result
	INNER JOIN test_case_resolution_status_time_series resolution ON ranked_dq_result.entityFQNHash = resolution.entityFQNHash
	WHERE ranked_dq_result.row_num = 1
) latest_dq_result ON exisiting_dq_result.entityFQNHash = latest_dq_result.entityFQNHash AND exisiting_dq_result.timestamp = latest_dq_result.timestamp
SET exisiting_dq_result.json = JSON_SET(
	exisiting_dq_result.json,
	'$.testCaseResolutionStatusReference',
	latest_dq_result.json
);
-- END: Incident Manager Migration
