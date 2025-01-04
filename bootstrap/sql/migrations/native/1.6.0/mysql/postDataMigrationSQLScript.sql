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

-- Add supportsDataDiff for Athena, BigQuery, Mssql, Mysql, Oracle, Postgres, Redshift, SapHana, Snowflake, Trino
UPDATE dbservice_entity
SET json = JSON_SET(json, '$.connection.config.supportsDataDiff', 'true')
WHERE serviceType IN ('Athena','BigQuery','Mssql','Mysql','Oracle','Postgres','Redshift','SapHana','Snowflake','Trino');


-- Add supportsSystemProfile for Snowflake, Redshift, and BigQuery
update dbservice_entity
set json = JSON_SET(json, '$.connection.config.supportsSystemProfile', true)
where serviceType in ('Snowflake', 'Redshift', 'BigQuery');

-- Update all rows in the consumers_dlq table to set the source column to 'publisher'
UPDATE consumers_dlq SET source = 'publisher';

DELETE from event_subscription_entity where name = "ActivityFeedAlert";

DROP INDEX event_time_index ON change_event;

CREATE INDEX idx_offset_event_time ON change_event (offset, eventTime);