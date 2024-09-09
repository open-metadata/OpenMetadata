-- Add FQN and UUID to data_quality_data_time_series records
UPDATE data_quality_data_time_series dqdts
INNER JOIN test_case tc ON dqdts.entityFQNHash = tc.fqnHash
SET dqdts.json = JSON_SET(dqdts.json,
	'$.testCaseFQN', tc.json->'$.fullyQualifiedName',
	'$.id', (SELECT UUID())
);