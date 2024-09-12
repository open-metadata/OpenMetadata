-- Add FQN and UUID to data_quality_data_time_series records
UPDATE data_quality_data_time_series dqdts
SET json = jsonb_set(
              jsonb_set(dqdts.json::jsonb, '{testCaseFQN}', tc.json->'fullyQualifiedName'),
              '{id}', to_jsonb(gen_random_uuid())
          )
FROM test_case tc
WHERE dqdts.entityfqnHash = tc.fqnHash;


-- Add id column to data_quality_data_time_series table
-- after we have added the id values to the records
ALTER TABLE data_quality_data_time_series
ADD COLUMN id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED,
ADD CONSTRAINT id_unique UNIQUE (id);

-- Create index on id column
CREATE INDEX IF NOT EXISTS  data_quality_data_time_series_id_index  ON data_quality_data_time_series (id);

-- Remove VIRTUAL status column from test_case table and remove
-- testCaseResult state from testCase; fetch from search repo.
ALTER TABLE test_case DROP COLUMN status;
UPDATE test_case SET json = jsonb_set(data, '{testCaseStatus}', json->'testCaseResult'->'testCaseStatus');
ALTER TABLE test_case ADD COLUMN status VARCHAR(56) GENERATED ALWAYS AS (json ->> 'testCaseStatus') STORED NULL;
