-- add timestamp index for test case result reindex performance
CREATE INDEX idx_timestamp_desc ON data_quality_data_time_series (timestamp DESC);

CREATE TABLE background_jobs (
  id BIGSERIAL PRIMARY KEY,
  jobType VARCHAR(256) NOT NULL,
  methodName VARCHAR(256) NOT NULL,
  jobArgs JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  createdBy VARCHAR(256) NOT NULL,
  createdAt BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updatedAt BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX idx_status_createdAt ON background_jobs (status, createdAt);
CREATE INDEX idx_createdBy ON background_jobs (createdBy);
CREATE INDEX idx_status ON background_jobs (status);
CREATE INDEX idx_jobType ON background_jobs (jobType);
CREATE INDEX idx_updatedAt ON background_jobs (updatedAt);

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

