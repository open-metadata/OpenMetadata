-- column deleted not needed for entities that don't support soft delete
ALTER TABLE query_entity DROP COLUMN deleted;
ALTER TABLE event_subscription_entity DROP COLUMN deleted;

-- create domain entity table
CREATE TABLE IF NOT EXISTS domain_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    fqnHash VARCHAR(256) NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
    );

-- create data product entity table
CREATE TABLE IF NOT EXISTS data_product_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    fqnHash VARCHAR(256) NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
    );

-- create search service entity
CREATE TABLE IF NOT EXISTS search_service_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    nameHash VARCHAR(256)  NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    serviceType VARCHAR(256) GENERATED ALWAYS AS (json ->> 'serviceType') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (nameHash)
    );

-- create search index entity
CREATE TABLE IF NOT EXISTS search_index_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    fqnHash VARCHAR(256) NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
    );

-- We were hardcoding retries to 0. Since we are now using the IngestionPipeline to set them, keep existing ones to 0.
UPDATE ingestion_pipeline_entity
SET json = jsonb_set(json::jsonb, '{airflowConfig,retries}', '0', true);

-- create stored procedure entity
CREATE TABLE IF NOT EXISTS stored_procedure_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    fqnHash VARCHAR(256) NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
    );

-- Add index on fromId and fromEntity columns
CREATE INDEX IF NOT EXISTS from_entity_type_index ON entity_relationship (fromId, fromEntity);

-- Add index on toId and toEntity columns
CREATE INDEX IF NOT EXISTS to_entity_type_index ON entity_relationship (toId, toEntity);

ALTER TABLE tag DROP CONSTRAINT IF EXISTS tag_fqnhash_key;

ALTER TABLE tag ADD CONSTRAINT unique_fqnHash UNIQUE (fqnHash);

ALTER TABLE tag ADD CONSTRAINT tag_pk PRIMARY KEY (id);


-- rename viewParsingTimeoutLimit for queryParsingTimeoutLimit
UPDATE ingestion_pipeline_entity
SET json = jsonb_set(
  json::jsonb #- '{sourceConfig,config,viewParsingTimeoutLimit}',
  '{sourceConfig,config,queryParsingTimeoutLimit}',
  (json #> '{sourceConfig,config,viewParsingTimeoutLimit}')::jsonb,
  true
)
WHERE json #>> '{pipelineType}' = 'metadata';

-- Rename sandboxDomain for instanceDomain
UPDATE dbservice_entity
SET json = jsonb_set(
  json::jsonb #- '{connection,config,sandboxDomain}',
  '{connection,config,instanceDomain}',
  (json #> '{connection,config,sandboxDomain}')::jsonb,
  true
)
WHERE serviceType = 'DomoDatabase';

UPDATE dashboard_service_entity
SET json = jsonb_set(
  json::jsonb #- '{connection,config,sandboxDomain}',
  '{connection,config,instanceDomain}',
  (json #> '{connection,config,sandboxDomain}')::jsonb,
  true
)
WHERE serviceType = 'DomoDashboard';

UPDATE pipeline_service_entity
SET json = jsonb_set(
  json::jsonb #- '{connection,config,sandboxDomain}',
  '{connection,config,instanceDomain}',
  (json #> '{connection,config,sandboxDomain}')::jsonb,
  true
)
WHERE serviceType = 'DomoPipeline';

-- Query Entity supports service, which requires FQN for name
ALTER TABLE query_entity RENAME COLUMN nameHash TO fqnHash;

CREATE INDEX IF NOT EXISTS idx_name_query_entity ON query_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_bot_entity ON bot_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_chart_entity ON chart_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_classification_entity ON classification (name);
CREATE INDEX IF NOT EXISTS idx_name_storage_container_entity ON storage_container_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_dashboard_data_model_entity ON dashboard_data_model_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_dashboard_entity ON dashboard_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_dashboard_service_entity ON dashboard_service_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_dashboard_insight_chart ON data_insight_chart (name);
CREATE INDEX IF NOT EXISTS idx_name_database_entity ON database_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_database_schema_entity ON database_schema_entity  (name);
CREATE INDEX IF NOT EXISTS idx_name_db_service_entity ON dbservice_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_event_subscription_entity ON event_subscription_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_glossary_entity ON glossary_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_glossary_term_entity ON glossary_term_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_ingestion_pipeline_entity ON ingestion_pipeline_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_kpi_entity ON kpi_entity  (name);
CREATE INDEX IF NOT EXISTS idx_messaging_service_name_entity ON messaging_service_entity (name);
CREATE INDEX IF NOT EXISTS idx_metadata_service_name_entity  ON metadata_service_entity (name);
CREATE INDEX IF NOT EXISTS idx_metric_name_entity ON metric_entity (name);
CREATE INDEX IF NOT EXISTS idx_ml_model_name_entity ON ml_model_entity (name);
CREATE INDEX IF NOT EXISTS idx_ml_model_service_name_entity ON mlmodel_service_entity (name);
CREATE INDEX IF NOT EXISTS idx_pipeline_name_entity ON pipeline_entity (name);
CREATE INDEX IF NOT EXISTS idx_pipeline_service_name_entity ON pipeline_service_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_policy_entity ON policy_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_query_entity ON query_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_report_entity ON report_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_role_entity ON role_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_storage_service_entity ON storage_service_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_table_entity ON table_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_tag_entity ON tag (name);
CREATE INDEX IF NOT EXISTS idx_name_team_entity ON team_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_test_case ON test_case (name);
CREATE INDEX IF NOT EXISTS idx_name_test_connection_definition ON test_connection_definition (name);
CREATE INDEX IF NOT EXISTS idx_name_test_definition ON test_definition (name);
CREATE INDEX IF NOT EXISTS idx_name_test_suite ON test_suite (name);
CREATE INDEX IF NOT EXISTS idx_name_topic_entity ON topic_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_type_entity ON type_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_user_entity ON user_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_web_analytic_event ON web_analytic_event (name);
CREATE INDEX IF NOT EXISTS idx_name_automations_workflow ON automations_workflow (name);
CREATE INDEX IF NOT EXISTS idx_name_domain_entity ON domain_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_data_product_entity ON data_product_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_data_search_service_entity ON search_service_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_data_search_index_entity ON search_index_entity (name);
CREATE INDEX IF NOT EXISTS idx_name_data_stored_procedure_entity ON stored_procedure_entity (name);

CREATE TABLE IF NOT EXISTS persona_entity (
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
  name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
  nameHash VARCHAR(256) NOT NULL,
  json JSONB NOT NULL,
  updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
  updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (nameHash)
);
CREATE INDEX IF NOT EXISTS persona_name_index ON persona_entity USING btree (name);

CREATE TABLE IF NOT EXISTS doc_store (
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
  name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
  entityType VARCHAR(256) GENERATED ALWAYS AS (json ->> 'entityType') STORED NOT NULL,
  fqnHash VARCHAR(256) NOT NULL,
  json JSONB NOT NULL,
  updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
  updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (fqnHash)
);
CREATE INDEX IF NOT EXISTS page_name_index ON doc_store USING btree (name);
-- Remove Mark All Deleted Field
UPDATE ingestion_pipeline_entity
SET json = json::jsonb #- '{sourceConfig,config,markAllDeletedTables}'
WHERE json #>> '{pipelineType}' = 'metadata';


-- update entityReportData from pascale to camel case
UPDATE report_data_time_series
SET json = jsonb_set(
  json::jsonb #- '{reportDataType}',
  '{reportDataType}',
  '"entityReportData"',
  true
),
entityFQNHash = MD5('entityReportData')
WHERE json #>> '{reportDataType}' = 'EntityReportData';

-- update webAnalyticEntityViewReportData from pascale to camel case
UPDATE report_data_time_series
SET json = jsonb_set(
  json::jsonb #- '{reportDataType}',
  '{reportDataType}',
  '"webAnalyticEntityViewReportData"',
  true
),
entityFQNHash = MD5('webAnalyticEntityViewReportData')
WHERE json #>> '{reportDataType}' = 'WebAnalyticEntityViewReportData';

-- update webAnalyticUserActivityReportData from pascale to camel case
UPDATE report_data_time_series
SET json = jsonb_set(
  json::jsonb #- '{reportDataType}',
  '{reportDataType}',
  '"webAnalyticUserActivityReportData"',
  true
),
entityFQNHash = MD5('webAnalyticUserActivityReportData')
WHERE json #>> '{reportDataType}' = 'WebAnalyticUserActivityReportData';

CREATE TABLE IF NOT EXISTS installed_apps (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    nameHash VARCHAR(256) NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (nameHash)
    );

CREATE TABLE IF NOT EXISTS apps_marketplace (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    nameHash VARCHAR(256) NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (nameHash)
    );
   
CREATE TABLE IF NOT EXISTS apps_extension_time_series (
    appId VARCHAR(36) GENERATED ALWAYS AS (json ->> 'appId') STORED NOT NULL,      
    json JSONB NOT NULL,
    timestamp BIGINT GENERATED ALWAYS AS ((json ->> 'timestamp')::bigint) STORED NOT NULL
);  


-- Adding back the PK queries from 1.1.5 to keep the correct VARCHAR length
-- We don't have an ID, so we'll create a temp SERIAL number and use it for deletion
ALTER TABLE entity_extension_time_series ADD COLUMN temp SERIAL;
WITH CTE AS (
  SELECT temp, ROW_NUMBER() OVER (PARTITION BY entityFQNHash, extension, timestamp ORDER BY entityFQNHash) RN FROM entity_extension_time_series)
DELETE FROM entity_extension_time_series WHERE temp in (SELECT temp FROM CTE WHERE RN > 1);
ALTER TABLE entity_extension_time_series DROP COLUMN temp;

ALTER TABLE entity_extension_time_series ALTER COLUMN entityFQNHash TYPE VARCHAR(768), ALTER COLUMN jsonSchema TYPE VARCHAR(256) , ALTER COLUMN extension TYPE VARCHAR(256);
ALTER TABLE entity_extension_time_series DROP CONSTRAINT IF EXISTS entity_extension_time_series_constraint;
ALTER TABLE entity_extension_time_series ADD CONSTRAINT entity_extension_time_series_constraint UNIQUE (entityFQNHash, extension, timestamp);

-- Airflow pipeline status set to millis
UPDATE entity_extension_time_series ts
SET json = jsonb_set(
	ts.json,
	'{timestamp}',
	to_jsonb(cast(ts.json #> '{timestamp}' as int8) *1000)
)
FROM pipeline_entity p
WHERE ts.entityFQNHash  = p.fqnHash
  and ts.extension = 'pipeline.pipelineStatus'
  AND p.json #>> '{serviceType}' in ('Airflow', 'GluePipeline', 'Airbyte', 'Dagster', 'DomoPipeline')
;