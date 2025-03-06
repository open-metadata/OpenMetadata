UPDATE workflow_definition_entity
SET json = json - 'type'
WHERE json->>'type' IS NOT NULL;

-- Add status column to WorkflowInstances and WorkflowInstanceStates
ALTER TABLE workflow_instance_time_series
ADD COLUMN status VARCHAR(20)
GENERATED ALWAYS AS (json ->> 'status') STORED;

ALTER TABLE workflow_instance_time_series
ADD COLUMN entityLink VARCHAR(255) GENERATED ALWAYS AS
((jsonb -> 'variables' ->> 'global_relatedEntity')) STORED;


ALTER TABLE workflow_instance_state_time_series
ADD COLUMN status VARCHAR(20)
GENERATED ALWAYS AS (json ->> 'status') STORED;

-- Query Cost History Time Series
CREATE TABLE query_cost_time_series (
  id varchar(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
  cost real GENERATED ALWAYS AS (json ->> 'cost') STORED NOT NULL,
  count int GENERATED ALWAYS AS (json ->> 'count') STORED NOT NULL,
  timestamp bigint GENERATED ALWAYS AS ((json ->> 'timestamp')::bigint) STORED NOT NULL,
  jsonSchema varchar(256) NOT NULL,
  json jsonb NOT NULL,
  entityFQNHash varchar(768) COLLATE "C" DEFAULT NULL,
  CONSTRAINT query_cost_unique_constraint UNIQUE (id, timestamp, entityFQNHash)
);
CREATE INDEX IF NOT EXISTS query_cost_time_series_id on query_cost_time_series (id);
CREATE INDEX IF NOT EXISTS query_cost_time_series_id_timestamp  on test_case_resolution_status_time_series  (id, timestamp);
