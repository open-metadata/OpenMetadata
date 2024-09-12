-- Add FQN and UUID to data_quality_data_time_series records
UPDATE data_quality_data_time_series dqdts
INNER JOIN test_case tc ON dqdts.entityFQNHash = tc.fqnHash
SET dqdts.json = JSON_SET(dqdts.json,
	'$.testCaseFQN', tc.json->'$.fullyQualifiedName',
	'$.id', (SELECT UUID())
);

-- Remove VIRTUAL status column from test_case table and remove
ALTER TABLE test_case DROP COLUMN status;
UPDATE test_case SET json = JSON_SET(json, '$.testCaseStatus', JSON_EXTRACT(json, '$.testCaseResult.testCaseStatus'));
ALTER TABLE test_case ADD COLUMN status VARCHAR(56) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(json, '$.testCaseStatus'))) STORED;
