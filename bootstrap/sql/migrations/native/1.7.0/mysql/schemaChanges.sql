UPDATE workflow_definition_entity
SET json = JSON_REMOVE(json, '$.type')
WHERE JSON_EXTRACT(json, '$.type') IS NOT NULL;

-- Add status column to WorkflowInstances and WorkflowInstanceStates
ALTER TABLE workflow_instance_time_series ADD COLUMN status VARCHAR(20) GENERATED ALWAYS AS (json ->> '$.status') NOT NULL;
ALTER TABLE workflow_instance_time_series ADD COLUMN entityLink VARCHAR(255) GENERATED ALWAYS AS (json ->> '$.variables.global_relatedEntity');

ALTER TABLE workflow_instance_state_time_series ADD COLUMN status VARCHAR(20) GENERATED ALWAYS AS (json ->> '$.status') NOT NULL;

-- Query Cost History Time Series
CREATE TABLE query_cost_time_series (
  id varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.id'))) VIRTUAL NOT NULL,
  cost float GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.cost'))) VIRTUAL NOT NULL,
  count int GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.count'))) VIRTUAL NULL,
  timestamp bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.timestamp'))) VIRTUAL NOT NULL,
  jsonSchema varchar(256) NOT NULL,
  json json NOT NULL,
  entityFQNHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  CONSTRAINT query_cost_unique_constraint UNIQUE (timestamp,entityFQNHash),
  INDEX (id),
  INDEX (id, timestamp)

) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
