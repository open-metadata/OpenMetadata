-- noinspection SqlNoDataSourceInspectionForFile

-- column deleted not needed for entities that don't support soft delete
ALTER TABLE query_entity DROP COLUMN deleted;
ALTER TABLE event_subscription_entity DROP COLUMN deleted;

-- create domain entity table
CREATE TABLE IF NOT EXISTS domain_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    fqnHash VARCHAR(256) NOT NULL COLLATE ascii_bin,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (fqnHash),
    INDEX (name)
    );

-- create data product entity table
CREATE TABLE IF NOT EXISTS data_product_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    fqnHash VARCHAR(256) NOT NULL COLLATE ascii_bin,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (fqnHash),
    INDEX (name)
    );

-- create search service entity
CREATE TABLE IF NOT EXISTS search_service_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    nameHash VARCHAR(256)  NOT NULL COLLATE ascii_bin,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    serviceType VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.serviceType') NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted'),
    PRIMARY KEY (id),
    UNIQUE (nameHash),
    INDEX (name)
    );

-- create search index entity
CREATE TABLE IF NOT EXISTS search_index_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    fqnHash VARCHAR(256) NOT NULL COLLATE ascii_bin,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted'),
    PRIMARY KEY (id),
    UNIQUE (fqnHash),
    INDEX (name)
    );

-- We were hardcoding retries to 0. Since we are now using the IngestionPipeline to set them, keep existing ones to 0.
UPDATE ingestion_pipeline_entity
SET json = JSON_REPLACE(json, '$.airflowConfig.retries', 0)
WHERE JSON_EXTRACT(json, '$.airflowConfig.retries') IS NOT NULL;


-- create stored procedure entity
CREATE TABLE IF NOT EXISTS stored_procedure_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    fqnHash VARCHAR(256) NOT NULL COLLATE ascii_bin,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted'),
    PRIMARY KEY (id),
    UNIQUE (fqnHash),
    INDEX (name)
);

ALTER TABLE entity_relationship ADD INDEX from_entity_type_index(fromId, fromEntity), ADD INDEX to_entity_type_index(toId, toEntity);
ALTER TABLE tag DROP CONSTRAINT fqnHash, ADD CONSTRAINT UNIQUE(fqnHash), ADD PRIMARY KEY(id);


-- rename viewParsingTimeoutLimit for queryParsingTimeoutLimit
UPDATE ingestion_pipeline_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.sourceConfig.config.viewParsingTimeoutLimit'),
    '$.sourceConfig.config.queryParsingTimeoutLimit',
    JSON_EXTRACT(json, '$.sourceConfig.config.viewParsingTimeoutLimit')
)
WHERE JSON_EXTRACT(json, '$.pipelineType') = 'metadata';

-- Rename sandboxDomain for instanceDomain
UPDATE dbservice_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.sandboxDomain'),
    '$.connection.config.instanceDomain',
    JSON_EXTRACT(json, '$.connection.config.sandboxDomain')
)
WHERE serviceType = 'DomoDatabase';

UPDATE dashboard_service_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.sandboxDomain'),
    '$.connection.config.instanceDomain',
    JSON_EXTRACT(json, '$.connection.config.sandboxDomain')
)
WHERE serviceType = 'DomoDashboard';

UPDATE pipeline_service_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.sandboxDomain'),
    '$.connection.config.instanceDomain',
    JSON_EXTRACT(json, '$.connection.config.sandboxDomain')
)
WHERE serviceType = 'DomoPipeline';

-- Query Entity supports service, which requires FQN for name
ALTER TABLE query_entity CHANGE COLUMN nameHash fqnHash VARCHAR(256);
ALTER TABLE bot_entity add index bot_entity_name_index(name);
ALTER TABLE chart_entity add index chart_entity_name_index(name);
ALTER TABLE classification  add index classification_entity_name_index(name);
ALTER TABLE storage_container_entity add index storage_container_entity_name_index(name);
ALTER TABLE dashboard_data_model_entity add index dashboard_data_model_entity_name_index(name);
ALTER TABLE dashboard_entity add index dashboard_entity_name_index(name);
ALTER TABLE dashboard_service_entity add index dashboard_service_entity_name_index(name);
ALTER TABLE data_insight_chart add index data_insight_name_index(name);
ALTER TABLE database_entity  add index database_entity_name_index(name);
ALTER TABLE database_schema_entity  add index database_schema_entity_name_index(name);
ALTER TABLE dbservice_entity add index dbservice_entity_name_index(name);
ALTER TABLE event_subscription_entity add index event_subscription_entity_name_index(name);
ALTER TABLE glossary_entity add index glossary_entity_name_index(name);
ALTER TABLE glossary_term_entity add index glossary_term_entity_name_index(name);
ALTER TABLE ingestion_pipeline_entity add index ingestion_pipeline_entity_name_index(name);
ALTER TABLE kpi_entity   add index  kpi_entity_name_index(name);
ALTER TABLE messaging_service_entity add index  messaing_service_entity_name_index(name);
ALTER TABLE metadata_service_entity add index  metadata_service_entity_name_index(name);
ALTER TABLE metric_entity add index  metric_entity_name_index(name);

ALTER TABLE ml_model_entity add index  ml_model_entity_name_index(name);
ALTER TABLE mlmodel_service_entity add index  mlmodel_service_entity_name_index(name);
ALTER TABLE pipeline_entity add index  pipeline_entity_name_index(name);
ALTER TABLE pipeline_service_entity add index  pipeline_service_entity_name_index(name);
ALTER TABLE policy_entity add index  policy_entity_name_index(name);
ALTER TABLE query_entity add index  query_entity_name_index(name);
ALTER TABLE report_entity add index  report_entity_name_index(name);
ALTER TABLE role_entity add index  role_entity_name_index(name);
ALTER TABLE storage_service_entity add index  storage_service_entity_name_index(name);
ALTER TABLE table_entity add index table_entity_name_index(name);
ALTER TABLE tag add index tag_entity_name_index(name);
ALTER TABLE team_entity add index team_entity_name_index(name);
ALTER TABLE test_case  add index test_case_name_index(name);
ALTER TABLE test_connection_definition add index test_connection_definition_name_index(name);
ALTER TABLE test_definition add index test_definition_name_index(name);
ALTER TABLE test_suite add index test_suite_name_index(name);
ALTER TABLE topic_entity  add index topic_entity_name_index(name);
ALTER TABLE type_entity add index type_entity_name_index(name);
ALTER TABLE user_entity add index user_entity_name_index(name);
ALTER TABLE web_analytic_event add index web_analytic_event_name_index(name);
ALTER TABLE automations_workflow add index automations_workflow_name_index(name);

CREATE TABLE IF NOT EXISTS persona_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    nameHash VARCHAR(256) NOT NULL COLLATE ascii_bin,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (nameHash),
    INDEX persona_name_index(name)
);

CREATE TABLE IF NOT EXISTS doc_store (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    entityType VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.entityType') NOT NULL,
    fqnHash VARCHAR(256) NOT NULL COLLATE ascii_bin,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (fqnHash),
    INDEX doc_store_name_index(name)
);

-- Remove Mark All Deleted Field
UPDATE ingestion_pipeline_entity
SET json = JSON_REMOVE(json, '$.sourceConfig.config.markAllDeletedTables')
WHERE JSON_EXTRACT(json, '$.pipelineType') = 'metadata';


-- update entityReportData from pascale to camel case
UPDATE report_data_time_series
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.reportDataType'),
    '$.reportDataType',
    'entityReportData'),
    entityFQNHash = MD5('entityReportData')
WHERE JSON_EXTRACT(json, '$.reportDataType') = 'EntityReportData';

-- update webAnalyticEntityViewReportData from pascale to camel case
UPDATE report_data_time_series
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.reportDataType'),
    '$.reportDataType',
    'webAnalyticEntityViewReportData'),
    entityFQNHash = MD5('webAnalyticEntityViewReportData')
WHERE JSON_EXTRACT(json, '$.reportDataType') = 'WebAnalyticEntityViewReportData';

-- update webAnalyticUserActivityReportData from pascale to camel case
UPDATE report_data_time_series
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.reportDataType'),
    '$.reportDataType',
    'webAnalyticUserActivityReportData'),
    entityFQNHash = MD5('webAnalyticUserActivityReportData')
WHERE JSON_EXTRACT(json, '$.reportDataType') = 'WebAnalyticUserActivityReportData';

CREATE TABLE IF NOT EXISTS installed_apps (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    nameHash VARCHAR(256)  NOT NULL COLLATE ascii_bin,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted'),
    PRIMARY KEY (id),
    UNIQUE (nameHash)
    );
   
CREATE TABLE IF NOT EXISTS apps_marketplace (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    nameHash VARCHAR(256)  NOT NULL COLLATE ascii_bin,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted'),
    PRIMARY KEY (id),
    UNIQUE (nameHash)
    );
   
CREATE TABLE IF NOT EXISTS apps_extension_time_series (
    appId VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.appId') STORED NOT NULL,      
    json JSON NOT NULL,
	timestamp BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.timestamp') NOT NULL
);  

-- Adding back the COLLATE queries from 1.1.5 to keep the correct VARCHAR length
ALTER TABLE glossary_term_entity MODIFY fqnHash VARCHAR(756) COLLATE ascii_bin;

-- We don't have an ID, so we'll create a temp SERIAL number and use it for deletion
ALTER TABLE entity_extension_time_series ADD COLUMN temp SERIAL;
WITH CTE AS (
  SELECT temp, ROW_NUMBER() OVER (PARTITION BY entityFQNHash, extension, timestamp ORDER BY entityFQNHash) RN FROM entity_extension_time_series)
DELETE FROM entity_extension_time_series WHERE temp in (SELECT temp FROM CTE WHERE RN > 1);
ALTER TABLE entity_extension_time_series DROP COLUMN temp;

ALTER TABLE entity_extension_time_series MODIFY COLUMN entityFQNHash VARCHAR(768) COLLATE ascii_bin, MODIFY COLUMN jsonSchema VARCHAR(256) COLLATE ascii_bin, MODIFY COLUMN extension VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE entity_extension_time_series DROP CONSTRAINT entity_extension_time_series_constraint, ADD CONSTRAINT entity_extension_time_series_constraint UNIQUE (entityFQNHash, extension, timestamp);

-- Airflow pipeline status set to millis
UPDATE entity_extension_time_series ts
JOIN pipeline_entity p
  ON ts.entityFQNHash  = p.fqnHash
SET ts.json = JSON_INSERT(
    JSON_REMOVE(ts.json, '$.timestamp'),
    '$.timestamp',
    JSON_EXTRACT(ts.json, '$.timestamp') * 1000
 )
WHERE ts.extension = 'pipeline.pipelineStatus'
  AND JSON_EXTRACT(p.json, '$.serviceType') in ('Airflow', 'GluePipeline', 'Airbyte', 'Dagster', 'DomoPipeline')
;
