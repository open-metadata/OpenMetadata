-- Clean dangling workflows not removed after test connection
truncate automations_workflow;

-- App Data Store
CREATE TABLE IF NOT EXISTS apps_data_store (
    identifier VARCHAR(256) NOT NULL,      
    type VARCHAR(256) NOT NULL,   
    json JSON NOT NULL
);

-- Add the source column to the consumers_dlq table
ALTER TABLE consumers_dlq ADD COLUMN source VARCHAR(255);

-- Create an index on the source column in the consumers_dlq table
CREATE INDEX idx_consumers_dlq_source ON consumers_dlq (source);

-- Rename 'offset' to 'currentOffset' and add 'startingOffset'
UPDATE change_event_consumers
SET json = jsonb_set(
    jsonb_set(json, '{currentOffset}', json -> 'offset'),
    '{startingOffset}', json -> 'offset'
)
WHERE json -> 'offset' IS NOT NULL
  AND jsonSchema = 'eventSubscriptionOffset';