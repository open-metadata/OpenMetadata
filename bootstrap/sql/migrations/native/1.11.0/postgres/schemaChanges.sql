-- Test Case Dimension Results Time Series Table
CREATE TABLE IF NOT EXISTS test_case_dimension_results_time_series (
  entityFQNHash VARCHAR(768) COLLATE "C" NOT NULL,
  extension VARCHAR(256) NOT NULL DEFAULT 'testCase.dimensionResult',
  jsonSchema VARCHAR(256) NOT NULL,
  json JSONB NOT NULL,
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
  testCaseResultId VARCHAR(36) GENERATED ALWAYS AS (json ->> 'testCaseResultId') STORED NOT NULL,
  dimensionKey VARCHAR(512) GENERATED ALWAYS AS (json ->> 'dimensionKey') STORED NOT NULL,
  timestamp BIGINT GENERATED ALWAYS AS ((json ->> 'timestamp')::bigint) STORED NOT NULL,
  testCaseStatus VARCHAR(36) GENERATED ALWAYS AS (json ->> 'testCaseStatus') STORED,
  CONSTRAINT test_case_dimension_results_unique_constraint UNIQUE (entityFQNHash, dimensionKey, timestamp)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS test_case_dimension_results_main ON test_case_dimension_results_time_series (entityFQNHash, timestamp, dimensionKey);
CREATE INDEX IF NOT EXISTS test_case_dimension_results_result_id ON test_case_dimension_results_time_series (testCaseResultId);
CREATE INDEX IF NOT EXISTS test_case_dimension_results_ts ON test_case_dimension_results_time_series (timestamp);