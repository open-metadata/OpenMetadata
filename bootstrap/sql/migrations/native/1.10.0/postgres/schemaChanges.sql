-- Update automations_workflow status column to extract from workflowStatus field
-- This is needed because status field is now used for approval state across all entities
-- and the workflow execution status has been renamed to workflowStatus in the JSON

-- Step 1: Update existing JSON data to rename 'status' to 'workflowStatus'
UPDATE automations_workflow 
SET json = jsonb_set(
    json - 'status',
    '{workflowStatus}',
    json -> 'status'
)
WHERE json -> 'status' IS NOT NULL;

-- Step 2: Alter the table to update the generated column
ALTER TABLE automations_workflow 
  DROP COLUMN status;

ALTER TABLE automations_workflow 
  ADD COLUMN status VARCHAR(256) GENERATED ALWAYS AS ((json ->> 'workflowStatus')) STORED;