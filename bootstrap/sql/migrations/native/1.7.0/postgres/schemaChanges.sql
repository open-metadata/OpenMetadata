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