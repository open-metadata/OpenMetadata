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
