-- Data quality failure status extension time series
CREATE TABLE test_case_resolution_status_time_series (
  id varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract_path_text(json, 'id'))) STORED NOT NULL,
  sequenceId varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract_path_text(json, 'sequenceId'))) STORED NOT NULL,
  extension varchar(256) NOT NULL,
  timestamp bigint GENERATED ALWAYS AS (json_unquote(json_extract_path_text(json, 'timestamp'))) STORED NOT NULL,
  testCaseResolutionStatusType varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract_path_text(json, 'testCaseResolutionStatusType'))) STORED NOT NULL,
  jsonSchema varchar(256) NOT NULL,
  json jsonb NOT NULL,
  entityFQNHash varchar(768) COLLATE "C" DEFAULT NULL,
  CONSTRAINT test_case_resolution_status_unique_constraint UNIQUE (id, timestamp, extension),
  INDEX (id),
  INDEX (testCaseResolutionStatusType),
  INDEX (id, testCaseResolutionStatusType)
)

-- DataInsightsApplication should not allow configuration
UPDATE apps_marketplace
SET json = jsonb_set(
	json::jsonb,
	'{allowConfiguration}',
	to_jsonb(false)
)
where name = 'DataInsightsApplication';

UPDATE installed_apps
SET json = jsonb_set(
	json::jsonb,
	'{allowConfiguration}',
	to_jsonb(false)
)
where name = 'DataInsightsApplication';
