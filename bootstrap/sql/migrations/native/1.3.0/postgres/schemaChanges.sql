-- Data quality failure status extension time series
CREATE TABLE test_case_resolution_status_time_series (
  id varchar(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
  sequenceId varchar(36) GENERATED ALWAYS AS (json ->> 'sequenceId') STORED NOT NULL,
  assignee varchar(256) GENERATED ALWAYS AS (
      CASE
          WHEN json->'testCaseResolutionStatusDetails' IS NOT NULL AND
               json->'testCaseResolutionStatusDetails'->'assignee' IS NOT NULL AND
               json->'testCaseResolutionStatusDetails'->'assignee'->>'name' IS NOT NULL
          THEN json->'testCaseResolutionStatusDetails'->'assignee'->>'name'
          ELSE NULL
      END
  ) STORED NULL,
  timestamp bigint GENERATED ALWAYS AS ((json ->> 'timestamp')::bigint) STORED NOT NULL,
  testCaseResolutionStatusType varchar(36) GENERATED ALWAYS AS (json ->> 'testCaseResolutionStatusType') STORED NOT NULL,
  jsonSchema varchar(256) NOT NULL,
  json jsonb NOT NULL,
  entityFQNHash varchar(768) COLLATE "C" DEFAULT NULL,
  CONSTRAINT test_case_resolution_status_unique_constraint UNIQUE (id, timestamp, extension)
);
create index test_case_resolution_status_time_series_id on test_case_resolution_status_time_series (id);
create index test_case_resolution_status_time_series_status_type on test_case_resolution_status_time_series  (testCaseResolutionStatusType);
create index test_case_resolution_status_time_series_id_status_type  on test_case_resolution_status_time_series  (id, testCaseResolutionStatusType);

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
