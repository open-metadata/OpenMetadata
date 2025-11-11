UPDATE workflow_definition_entity
SET json = json - 'type'
WHERE json->>'type' IS NOT NULL;

-- Add status column to WorkflowInstances and WorkflowInstanceStates
-- entityLink is generated through variables->global_relatedEntity due to the following reasons:
-- 1. Flowable shares state through variables that get written into the database and we are persisting those
-- 2. We are using a namespace system to define from which "Node" the variable should be fetched
-- 3. We are saving the entityLink that triggers the workflow on the `relatedEntity` variable, within the `global` namespace
ALTER TABLE workflow_instance_time_series
ADD COLUMN status VARCHAR(20)
GENERATED ALWAYS AS (json ->> 'status') STORED;

ALTER TABLE workflow_instance_time_series
ADD COLUMN exceptionStacktrace TEXT
GENERATED ALWAYS AS (json ->> 'exception') STORED;

ALTER TABLE workflow_instance_time_series
ADD COLUMN entityLink VARCHAR(255) GENERATED ALWAYS AS
((json -> 'variables' ->> 'global_relatedEntity')) STORED;


ALTER TABLE workflow_instance_state_time_series
ADD COLUMN status VARCHAR(20)
GENERATED ALWAYS AS (json ->> 'status') STORED;

ALTER TABLE workflow_instance_state_time_series
ADD COLUMN exceptionStacktrace TEXT
GENERATED ALWAYS AS (json ->> 'exception') STORED;

-- Query Cost History Time Series
CREATE TABLE query_cost_time_series (
  id varchar(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
  cost real GENERATED ALWAYS AS ((json ->> 'cost')::real) STORED NOT NULL,
  count float GENERATED ALWAYS AS ((json ->> 'count')::float) STORED NOT NULL,
  timestamp bigint GENERATED ALWAYS AS ((json ->> 'timestamp')::bigint) STORED NOT NULL,
  jsonSchema varchar(256) NOT NULL,
  json jsonb NOT NULL,
  entityFQNHash varchar(768) COLLATE "C" DEFAULT NULL,
  CONSTRAINT query_cost_unique_constraint UNIQUE (timestamp, entityFQNHash)
);
CREATE INDEX IF NOT EXISTS query_cost_time_series_id on query_cost_time_series (id);
CREATE INDEX IF NOT EXISTS query_cost_time_series_id_timestamp  on test_case_resolution_status_time_series  (id, timestamp);

 UPDATE workflow_definition_entity
 SET json = jsonb_set(json, '{trigger,type}', '"eventBasedEntity"')
 WHERE json->'trigger'->>'type' in ('eventBasedEntityTrigger', 'eventBasedEntityWorkflow');

 UPDATE workflow_definition_entity
 SET json = jsonb_set(json, '{trigger,type}', '"periodicBatchEntity"')
 WHERE json->'trigger'->>'type' in ('periodicBatchEntityTrigger', 'periodicBatchEntityWorkflow');

DELETE FROM apps_extension_time_series;