-- Data quality failure status extension time series
CREATE TABLE test_case_resolution_status_time_series (
  id varchar(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
  stateId varchar(36) GENERATED ALWAYS AS (json ->> 'stateId') STORED NOT NULL,
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
  CONSTRAINT test_case_resolution_status_unique_constraint UNIQUE (id, timestamp, entityFQNHash)
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

-- Remove mssql connection from airflow db
UPDATE pipeline_service_entity pse
SET json = jsonb_set(
    json,
    '{connection, config}',
    json->'connection'->'config' #- '{connection}'
)
WHERE serviceType = 'Airflow'
AND json #>> '{connection,config,connection,type}' = 'Mssql';

-- Rename NOOP Secret Manager to DB
update metadata_service_entity
set json = jsonb_set(
  json #- '{connection,config,secretsManagerProvider}',
  '{connection,config,secretsManagerProvider}',
  '"db"',
  true
)
where name = 'OpenMetadata'
  and json #>> '{connection,config,secretsManagerProvider}' = 'noop';

-- Clean old test connections
TRUNCATE automations_workflow;

-- Update Change Event Table
ALTER TABLE change_event ADD COLUMN offset SERIAL PRIMARY KEY;

-- Add new table for event subscription extensions
CREATE TABLE IF NOT EXISTS change_event_consumers (
    id VARCHAR(36) NOT NULL,
    extension VARCHAR(256) NOT NULL,
    jsonSchema VARCHAR(256) NOT NULL,
    json jsonb NOT NULL,
    timestamp BIGINT GENERATED ALWAYS AS ((json ->> 'timestamp')::bigint) STORED NOT NULL,
    UNIQUE(id, extension)
);

DELETE FROM event_subscription_entity ese where name = 'DataInsightReport';

ALTER TABLE change_event_consumers ADD COLUMN offset SERIAL;

CREATE TABLE IF NOT EXISTS consumers_dlq (
    id VARCHAR(36) NOT NULL,
    extension VARCHAR(256) NOT NULL,
    json jsonb NOT NULL,
    timestamp BIGINT GENERATED ALWAYS AS ((json ->> 'timestamp')::bigint) STORED NOT NULL
);