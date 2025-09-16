-- Test Case Dimension Results Time Series Table
CREATE TABLE IF NOT EXISTS test_case_dimension_results_time_series (
  entityFQNHash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  extension VARCHAR(256) NOT NULL DEFAULT 'testCase.dimensionResult',
  jsonSchema VARCHAR(256) NOT NULL,
  json JSON NOT NULL,
  id VARCHAR(36) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.id'))) STORED NOT NULL,
  testCaseResultId VARCHAR(36) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.testCaseResultId'))) STORED NOT NULL,
  dimensionKey VARCHAR(512) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.dimensionKey'))) STORED NOT NULL,
  timestamp BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.timestamp'))) STORED NOT NULL,
  testCaseStatus VARCHAR(36) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.testCaseStatus'))) STORED,
  UNIQUE KEY test_case_dimension_results_unique_constraint (entityFQNHash, dimensionKey, timestamp),
  INDEX test_case_dimension_results_main (entityFQNHash, timestamp, dimensionKey),
  INDEX test_case_dimension_results_result_id (testCaseResultId),
  INDEX test_case_dimension_results_ts (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;