-- Delete data quality records with no linked test case FQN in the test_case table
DELETE dqdts
FROM data_quality_data_time_series dqdts
LEFT JOIN test_case tc ON dqdts.entityFQNHash = tc.fqnHash
WHERE tc.fqnHash IS NULL;

-- Add FQN and UUID to data_quality_data_time_series records
UPDATE data_quality_data_time_series dqdts
INNER JOIN test_case tc ON dqdts.entityFQNHash = tc.fqnHash
SET dqdts.json = JSON_SET(dqdts.json,
	'$.testCaseFQN', tc.json->'$.fullyQualifiedName',
	'$.id', (SELECT UUID())
);

-- Add id column to data_quality_data_time_series table
-- after we have added the id values to the records
ALTER TABLE data_quality_data_time_series
ADD COLUMN id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
ADD CONSTRAINT UNIQUE (id);

-- Create index on id column
CREATE INDEX data_quality_data_time_series_id_index ON data_quality_data_time_series (id);

-- Remove VIRTUAL status column from test_case table and remove
-- testCaseResult state from testCase; fetch from search repo.
ALTER TABLE test_case DROP COLUMN status;

UPDATE test_case SET json = JSON_SET(json, '$.testCaseStatus', JSON_EXTRACT(json, '$.testCaseResult.testCaseStatus'))
WHERE JSON_EXTRACT(json, '$.testCaseResult.testCaseStatus') IS NOT NULL;

ALTER TABLE test_case ADD COLUMN status VARCHAR(56) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(json, '$.testCaseStatus'))) STORED;


-- Remove test case result states
UPDATE test_suite
SET json = JSON_REMOVE(json, '$.testCaseResultSummary');

UPDATE test_case
SET json = JSON_REMOVE(json, '$.testCaseResult');

-- Add Supports interrupts to SearchIndexingApplication
UPDATE installed_apps SET json = JSON_SET(json, '$.supportsInterrupt', true) where name = 'SearchIndexingApplication'; 
UPDATE apps_marketplace  SET json = JSON_SET(json, '$.supportsInterrupt', true) where name = 'SearchIndexingApplication';

ALTER TABLE apps_extension_time_series ADD COLUMN appName VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.appName') STORED NOT NULL;

-- Update all rows in the consumers_dlq table to set the source column to 'publisher'
UPDATE consumers_dlq SET source = 'publisher';