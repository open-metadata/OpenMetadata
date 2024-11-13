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

-- Data Insight charts: add metrics field
UPDATE 
  di_chart_entity 
SET 
  json = jsonb_set(
    json #- '{chartDetails,formula}' #- '{chartDetails,filter}' #- '{chartDetails,function}' #- '{chartDetails,field}' #- '{chartDetails,treeFilter}',
    '{chartDetails,metrics}', 
    jsonb_build_array(
      jsonb_strip_nulls(
        jsonb_build_object(
          'formula', json -> 'chartDetails' -> 'formula', 
          'filter', json -> 'chartDetails' -> 'filter', 
          'function', json -> 'chartDetails' -> 'function', 
          'field', json -> 'chartDetails' -> 'field', 
          'treeFilter', json -> 'chartDetails' -> 'treeFilter'
        )
      )
    )
  ) 
WHERE 
  json -> 'chartDetails' -> 'metrics' is null;


-- Rename 'offset' to 'currentOffset' and add 'startingOffset'
UPDATE change_event_consumers
SET json = jsonb_set(
    jsonb_set(json, '{currentOffset}', json -> 'offset'),
    '{startingOffset}', json -> 'offset'
)
WHERE json -> 'offset' IS NOT NULL
  AND jsonSchema = 'eventSubscriptionOffset';


-- Create table successful_sent_change_events for storing successfully sent events per alert
CREATE TABLE IF NOT EXISTS successful_sent_change_events (
    id VARCHAR(36) PRIMARY KEY,
    change_event_id VARCHAR(36) NOT NULL,
    event_subscription_id VARCHAR(36) NOT NULL,
    json jsonb NOT NULL,
    timestamp BIGINT NOT NULL
);

-- Create an index on the event_subscription_id column in the successful_sent_change_events table
CREATE INDEX idx_event_subscription_id ON successful_sent_change_events (event_subscription_id);

-- Remove Override View Lineage
UPDATE ingestion_pipeline_entity
SET json = json::jsonb #- '{sourceConfig,config,overrideViewLineage}'
WHERE json #>> '{pipelineType}' = 'metadata';
