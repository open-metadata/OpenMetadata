-- Update automations_workflow status column to extract from workflowStatus field
-- This is needed because status field is now used for approval state across all entities
-- and the workflow execution status has been renamed to workflowStatus in the JSON

-- Step 1: Update existing JSON data to rename 'status' to 'workflowStatus'
UPDATE automations_workflow 
SET json = JSON_SET(
    JSON_REMOVE(json, '$.status'),
    '$.workflowStatus', 
    JSON_EXTRACT(json, '$.status')
)
WHERE JSON_EXTRACT(json, '$.status') IS NOT NULL;

-- Step 2: Alter the table to update the generated column
ALTER TABLE automations_workflow 
  DROP COLUMN status,
  ADD COLUMN status VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.workflowStatus') STORED;