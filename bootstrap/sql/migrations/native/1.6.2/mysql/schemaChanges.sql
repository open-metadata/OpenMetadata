-- add timestamp index for test case result reindex performance
ALTER TABLE data_quality_data_time_series ADD INDEX `idx_timestamp_desc` (timestamp DESC);

CREATE TABLE background_jobs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  jobType VARCHAR(256) NOT NULL,
  methodName VARCHAR(256) NOT NULL,
  jobArgs JSON NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  createdBy VARCHAR(256) NOT NULL,
  createdAt BIGINT UNSIGNED NOT NULL DEFAULT (UNIX_TIMESTAMP(NOW(3)) * 1000),
  updatedAt BIGINT UNSIGNED NOT NULL DEFAULT (UNIX_TIMESTAMP(NOW(3)) * 1000)
);

CREATE INDEX idx_status_createdAt ON background_jobs (status, createdAt);
CREATE INDEX idx_createdBy ON background_jobs (createdBy);
CREATE INDEX idx_status ON background_jobs (status);
CREATE INDEX idx_jobType ON background_jobs (jobType);
CREATE INDEX idx_updatedAt ON background_jobs (updatedAt);

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

-- clean up the testSuites in the version history too
UPDATE entity_extension SET json = json_remove(json, '$.testSuites') WHERE jsonSchema = 'testCase';

