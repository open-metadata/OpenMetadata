-- add timestamp index for test case result reindex performance
ALTER TABLE data_quality_data_time_series ADD INDEX `idx_timestamp_desc` (timestamp DESC);

-- rename executable -> basic for test suites
UPDATE test_suite
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.executable'),
    '$.basic',
    JSON_EXTRACT(json, '$.executable')
)
WHERE JSON_EXTRACT(json, '$.executable') IS NOT NULL;

-- rename executableEntityReference -> basicEntityReference for test suites
UPDATE test_suite
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.executableEntityReference'),
    '$.basicEntityReference',
    JSON_EXTRACT(json, '$.executableEntityReference')
)
WHERE JSON_EXTRACT(json, '$.executableEntityReference') IS NOT NULL;

-- clean up the testSuites
UPDATE test_case SET json = json_remove(json, '$.testSuites');
