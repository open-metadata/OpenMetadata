-- add timestamp index for test case result reindex performance
CREATE INDEX idx_timestamp_desc ON data_quality_data_time_series (timestamp DESC);

-- rename executable -> basic for test suites
UPDATE test_suite
SET json = jsonb_set(
  json::jsonb #- '{executable}',
  '{basic}',
  (json #> '{executable}')::jsonb,
  true
)
WHERE json #>> '{executable}' IS NOT NULL;

-- rename executableEntityReference -> basicEntityReference for test suites
UPDATE test_suite
SET json = jsonb_set(
  json::jsonb #- '{executableEntityReference}',
  '{basicEntityReference}',
  (json #> '{executableEntityReference}')::jsonb,
  true
)
WHERE json #>> '{executableEntityReference}' IS NOT NULL;

-- clean up the testSuites
UPDATE test_case SET json = json::jsonb #- '{testSuites}';

-- clean up the testSuites in the version history too
UPDATE entity_extension SET json = json::jsonb #- '{testSuites}' WHERE jsonSchema = 'testCase';
