-- Rename customMetricsProfile to customMetrics
UPDATE profiler_data_time_series
SET json = REPLACE(json::text, '"customMetricsProfile"', '"customMetrics"')::jsonb;

-- Delete customMetricsProfile from entity_extension
-- This was not supported on the processing side before 1.3.
DELETE FROM entity_extension ee   
where extension  like '%customMetrics';

-- BEGIN: Incident Manager Migration
-- STEP 1: Update test case testCaseResult.testCaseFailureStatus field
UPDATE test_case tc
SET json = JSONB_SET(
	tc.json::jsonb #- '{testCaseResult,testCaseFailureStatus}',
	'{testCaseResult,testCaseResolutionStatusReference}',
	tcrsts.json::jsonb
)
from test_case_resolution_status_time_series tcrsts
WHERE tc.id = tcrsts.json#>>'{testCaseReference,id}' AND
tc.json#>'{testCaseResult,testCaseFailureStatus}' IS NOT NULL;

-- STEP 2: remove all `testCaseFailureStatus` field in test results
UPDATE data_quality_data_time_series d
SET json = json::jsonb#- '{testCaseFailureStatus}';

-- STEP 3: update latest test case result with new res. status
UPDATE data_quality_data_time_series exisiting_dq_result
SET json = JSONB_SET(
	exisiting_dq_result.json::jsonb,
	'{testCaseResolutionStatusReference}',
	latest_dq_result.json::jsonb
)
FROM (
	SELECT
		resolution.json,
		ranked_dq_result.timestamp,
		ranked_dq_result.entityFQNHash -- test case FQN Hash
	FROM (
		SELECT
			ROW_NUMBER() OVER(PARTITION BY entityFQNHash ORDER BY timestamp DESC) AS row_num,
			json,
			entityFQNHash,
			timestamp
		FROM data_quality_data_time_series
	) ranked_dq_result
	INNER JOIN test_case_resolution_status_time_series resolution ON ranked_dq_result.entityFQNHash = resolution.entityFQNHash
	WHERE ranked_dq_result.row_num = 1
) latest_dq_result
WHERE exisiting_dq_result.entityFQNHash = latest_dq_result.entityFQNHash and
exisiting_dq_result.timestamp = latest_dq_result.timestamp
-- END: Incident Manager Migration