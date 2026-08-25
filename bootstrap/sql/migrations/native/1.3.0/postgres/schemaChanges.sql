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
CREATE INDEX IF NOT EXISTS test_case_resolution_status_time_series_id on test_case_resolution_status_time_series (id);
CREATE INDEX IF NOT EXISTS test_case_resolution_status_time_series_status_type on test_case_resolution_status_time_series  (testCaseResolutionStatusType);
CREATE INDEX IF NOT EXISTS test_case_resolution_status_time_series_id_status_type  on test_case_resolution_status_time_series  (id, testCaseResolutionStatusType);

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

-- update service type to UnityCatalog - update database entity
UPDATE database_entity de
SET json = jsonb_set(
    json #- '{serviceType}',
    '{serviceType}',
    '"UnityCatalog"',
    true
 )
where id in (
select toId from entity_relationship er 
where 
  fromEntity = 'databaseService'
  and toEntity = 'database'
  and fromId in (
    select id from dbservice_entity dbe 
    where 
      serviceType = 'Databricks' 
      and (dbe.json #>> '{connection,config,useUnityCatalog}')::bool = true
  ));
 

-- update service type to UnityCatalog - update database schema entity
UPDATE database_schema_entity dse
SET json = jsonb_set(
    json #- '{serviceType}',
    '{serviceType}',
    '"UnityCatalog"',
    true
 )
where json #>> '{database,id}' in (
select toId from entity_relationship er 
where 
  fromEntity = 'databaseService'
  and toEntity = 'database'
  and fromId in (
    select id from dbservice_entity dbe 
    where 
      serviceType = 'Databricks' 
      and (dbe.json #>> '{connection,config,useUnityCatalog}')::bool = true
  ));

-- update service type to UnityCatalog - update table entity
UPDATE table_entity te
SET json = jsonb_set(
    json #- '{serviceType}',
    '{serviceType}',
    '"UnityCatalog"',
    true
 )
where json #>> '{database,id}' in (
select toId from entity_relationship er 
where 
  fromEntity = 'databaseService'
  and toEntity = 'database'
  and fromId in (
    select id from dbservice_entity dbe 
    where 
      serviceType = 'Databricks' 
      and (dbe.json #>> '{connection,config,useUnityCatalog}')::bool = true
  ));


-- update service type to UnityCatalog - update db service entity
UPDATE dbservice_entity de
SET json = jsonb_set(
    jsonb_set(
    de.json #- '{serviceType}',
    '{serviceType}',
    '"UnityCatalog"'
 ) #- '{connection,config,type}',
    '{connection,config,type}',
    '"UnityCatalog"'
 )
WHERE de.serviceType = 'Databricks'
  AND (de.json #>> '{connection,config,useUnityCatalog}')::bool = True
;

-- remove `useUnityCatalog` flag from service connection details of databricks
UPDATE dbservice_entity de 
SET json = json #- '{connection,config,useUnityCatalog}'
WHERE de.serviceType IN ('Databricks','UnityCatalog');

-- Add Incident ID for test case results
ALTER TABLE data_quality_data_time_series ADD COLUMN incidentId varchar(36);
CREATE INDEX IF NOT EXISTS data_quality_data_time_series_incidentId ON data_quality_data_time_series(incidentId);

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

-- Update Change Event Table
ALTER TABLE change_event ADD COLUMN "offset" SERIAL PRIMARY KEY;

CREATE TABLE IF NOT EXISTS consumers_dlq (
    id VARCHAR(36) NOT NULL,
    extension VARCHAR(256) NOT NULL,
    json jsonb NOT NULL,
    timestamp BIGINT GENERATED ALWAYS AS ((json ->> 'timestamp')::bigint) STORED NOT NULL,
    UNIQUE(id, extension)
);

-- Add supportsQueryComment to MSSQL
update dbservice_entity
set json = jsonb_set(json::jsonb, '{connection,config,supportsQueryComment}', 'true', true)
where serviceType = 'Mssql';

DELETE FROM event_subscription_entity;
DELETE FROM change_event_consumers;
DELETE FROM consumers_dlq;

CREATE TABLE IF NOT EXISTS suggestions (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    fqnHash VARCHAR(256) NOT NULL,
    entityLink VARCHAR(256) GENERATED ALWAYS AS (json ->> 'entityLink') STORED NOT NULL,
    suggestionType VARCHAR(36) GENERATED ALWAYS AS (json ->> 'type') STORED NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    status VARCHAR(256) GENERATED ALWAYS AS (json ->> 'status') STORED NOT NULL,
    PRIMARY KEY (id)
);

UPDATE ingestion_pipeline_entity SET json = JSONB_SET(json::jsonb, '{provider}', '"user"', true)
WHERE json->>'name' = 'OpenMetadata_dataInsight';