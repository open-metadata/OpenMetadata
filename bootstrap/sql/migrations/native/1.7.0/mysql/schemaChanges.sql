UPDATE workflow_definition_entity
SET json = JSON_REMOVE(json, '$.type')
WHERE JSON_EXTRACT(json, '$.type') IS NOT NULL;

-- Add status column to WorkflowInstances and WorkflowInstanceStates
ALTER TABLE workflow_instance_time_series ADD COLUMN status VARCHAR(20) GENERATED ALWAYS AS (json ->> '$.status') NOT NULL;
ALTER TABLE workflow_instance_time_series ADD COLUMN entityLink VARCHAR(255) GENERATED ALWAYS AS (json ->> '$.variables.global_relatedEntity');

ALTER TABLE workflow_instance_state_time_series ADD COLUMN status VARCHAR(20) GENERATED ALWAYS AS (json ->> '$.status') NOT NULL;