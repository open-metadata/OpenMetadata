-- Create Workflow Definition Entity
CREATE TABLE IF NOT EXISTS workflow_definition_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') NOT NULL,
    fqnHash VARCHAR(256) NOT NULL COLLATE ascii_bin,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) NOT NULL,
    updatedBy VARCHAR(256) ALWAYS AS ((json ->> 'updatedBy')::bigint) NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

-- Workflow Instance extension time series
CREATE TABLE workflow_instance_state_time_series (
  id varchar(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
  workflowInstanceId varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.workflowInstanceId'))) STORED NOT NULL,
  timestamp bigint GENERATED ALWAYS AS ((json ->> 'timestamp')::bigint) STORED NOT NULL,
  jsonSchema varchar(256) NOT NULL,
  json jsonb NOT NULL,
  entityFQNHash varchar(768) COLLATE "C" DEFAULT NULL,
  CONSTRAINT workflow_instance_time_series_unique_constraint UNIQUE (id, timestamp, entityFQNHash),
  INDEX (id)

-- Extend app extension for limits
ALTER TABLE apps_extension_time_series ADD COLUMN extension VARCHAR(255);
UPDATE apps_extension_time_series SET extension = 'status' WHERE extension IS NULL;
ALTER TABLE apps_extension_time_series ALTER COLUMN extension SET NOT NULL;
CREATE INDEX IF NOT EXISTS apps_extension_time_series_extension ON apps_extension_time_series(extension);

-- Clean dangling workflows not removed after test connection
truncate automations_workflow;

-- App Data Store
CREATE TABLE IF NOT EXISTS apps_data_store (
    identifier VARCHAR(256) NOT NULL,      
    type VARCHAR(256) NOT NULL,   
    json JSON NOT NULL
);