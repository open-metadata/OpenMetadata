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