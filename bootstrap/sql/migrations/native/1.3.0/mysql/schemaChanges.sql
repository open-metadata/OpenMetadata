-- Data quality failure status extension time series
CREATE TABLE test_case_resolution_status_time_series (
  id varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.id'))) VIRTUAL NOT NULL,
  stateId varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.stateId'))) VIRTUAL NOT NULL,
  assignee varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.testCaseResolutionStatusDetails.assignee.name'))) VIRTUAL NULL,
  timestamp bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.timestamp'))) VIRTUAL NOT NULL,
  testCaseResolutionStatusType varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.testCaseResolutionStatusType'))) VIRTUAL NOT NULL,
  jsonSchema varchar(256) NOT NULL,
  json json NOT NULL,
  entityFQNHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  CONSTRAINT test_case_resolution_status_unique_constraint UNIQUE (id,timestamp,entityFQNHash),
  INDEX (id),
  INDEX(testCaseResolutionStatusType),
  INDEX(id, testCaseResolutionStatusType)

) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- DataInsightsApplication should not allow configuration
update apps_marketplace
set json = JSON_INSERT(
  JSON_REMOVE(json, '$.allowConfiguration'),
  '$.allowConfiguration',
  false
)
where name = 'DataInsightsApplication';

update installed_apps
set json = JSON_INSERT(
  JSON_REMOVE(json, '$.allowConfiguration'),
  '$.allowConfiguration',
  false
)
where name = 'DataInsightsApplication';

-- Remove mssql connection from airflow db
UPDATE pipeline_service_entity pse 
SET json = JSON_REMOVE(json, '$.connection.config.connection')
WHERE serviceType = 'Airflow'
AND JSON_EXTRACT(json, '$.connection.config.connection.type') = 'Mssql';

-- Rename NOOP Secret Manager to DB
update metadata_service_entity
set json = JSON_REPLACE(json, '$.connection.config.secretsManagerProvider', 'db')
where name = 'OpenMetadata'
  and JSON_EXTRACT(json, '$.connection.config.secretsManagerProvider') = 'noop';

-- Clean old test connections
TRUNCATE automations_workflow;

-- update service type to UnityCatalog - update database entity
UPDATE database_entity de
SET de.json = JSON_INSERT(
    JSON_REMOVE(de.json, '$.serviceType'),
    '$.serviceType',
    'UnityCatalog'
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
      and JSON_EXTRACT(
        dbe.json, '$.connection.config.useUnityCatalog'
      ) = true
  ));
 

-- update service type to UnityCatalog - update database schema entity
UPDATE database_schema_entity dse
SET dse.json = JSON_INSERT(
    JSON_REMOVE(dse.json, '$.serviceType'),
    '$.serviceType',
    'UnityCatalog'
 )
where JSON_EXTRACT(dse.json, '$.database.id') in (
select toId from entity_relationship er 
where 
  fromEntity = 'databaseService'
  and toEntity = 'database'
  and fromId in (
    select id from dbservice_entity dbe 
    where 
      serviceType = 'Databricks' 
      and JSON_EXTRACT(
        dbe.json, '$.connection.config.useUnityCatalog'
      ) = true
  ));
 

-- update service type to UnityCatalog - update table entity
UPDATE table_entity te
SET te.json = JSON_INSERT(
    JSON_REMOVE(te.json, '$.serviceType'),
    '$.serviceType',
    'UnityCatalog'
 )
where JSON_EXTRACT(te.json, '$.database.id') in (
select toId from entity_relationship er 
where 
  fromEntity = 'databaseService'
  and toEntity = 'database'
  and fromId in (
    select id from dbservice_entity dbe 
    where 
      serviceType = 'Databricks' 
      and JSON_EXTRACT(
        dbe.json, '$.connection.config.useUnityCatalog'
      ) = true
  ));


-- update service type to UnityCatalog - update db service entity
UPDATE dbservice_entity de
SET de.json = JSON_INSERT(
    JSON_REMOVE(de.json, '$.connection.config.type'),
    '$.connection.config.type',
    'UnityCatalog'
 ),de.json = JSON_INSERT(
    JSON_REMOVE(de.json, '$.serviceType'),
    '$.serviceType',
    'UnityCatalog'
 ) 
WHERE de.serviceType = 'Databricks'
  AND JSON_EXTRACT(de.json, '$.connection.config.useUnityCatalog') = True
;

-- remove `useUnityCatalog` flag from service connection details of databricks
UPDATE dbservice_entity de 
SET de.json = JSON_REMOVE(de.json, '$.connection.config.useUnityCatalog')
WHERE de.serviceType IN ('Databricks','UnityCatalog');

-- Add Incident ID for test case results
ALTER TABLE data_quality_data_time_series ADD COLUMN incidentId varchar(36);
ALTER TABLE data_quality_data_time_series ADD INDEX data_quality_data_time_series_incidentId(incidentId);

-- Add new table for event subscription extensions
CREATE TABLE IF NOT EXISTS change_event_consumers (
    id VARCHAR(36) NOT NULL,
    extension VARCHAR(256) NOT NULL,
    jsonSchema VARCHAR(256) NOT NULL,
    json JSON NOT NULL,
	timestamp BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.timestamp') NOT NULL,
    UNIQUE(id, extension)
);

DELETE FROM event_subscription_entity ese where name = 'DataInsightReport';

-- Update Change Event Table
ALTER TABLE change_event ADD COLUMN offset INT AUTO_INCREMENT, ADD PRIMARY KEY (offset);

CREATE TABLE IF NOT EXISTS consumers_dlq (
    id VARCHAR(36) NOT NULL,
    extension VARCHAR(256) NOT NULL,
    json JSON NOT NULL,
    timestamp BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.timestamp') NOT NULL,
    UNIQUE(id, extension)
);

-- Add supportsQueryComment to MSSQL
update dbservice_entity
set json = JSON_SET(json, '$.connection.config.supportsQueryComment', true)
where serviceType = 'Mssql';

DELETE FROM event_subscription_entity;
DELETE FROM change_event_consumers;
DELETE FROM consumers_dlq;

CREATE TABLE IF NOT EXISTS suggestions (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    fqnHash VARCHAR(256) NOT NULL COLLATE ascii_bin,
    entityLink VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.entityLink') NOT NULL,
    suggestionType VARCHAR(36) GENERATED ALWAYS AS (json_unquote(json ->> '$.type')) NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    status VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json -> '$.status')) NOT NULL,
    PRIMARY KEY (id)
);

UPDATE ingestion_pipeline_entity SET json = JSON_SET(json, '$.provider', 'user')
WHERE JSON_EXTRACT(json, '$.name') = 'OpenMetadata_dataInsight';