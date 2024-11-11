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
   json = JSON_SET( JSON_REMOVE(json, '$.chartDetails.formula', '$.chartDetails.filter', '$.chartDetails.function', '$.chartDetails.field', '$.chartDetails.treeFilter' ), '$.chartDetails.metrics', JSON_ARRAY( (
   SELECT
      JSON_OBJECTAGG(my_key, value) 
   FROM
      (
         SELECT
            my_key,
            value 
         FROM
            (
               SELECT
                  'formula' AS my_key,
                  JSON_UNQUOTE(JSON_EXTRACT(json, '$.chartDetails.formula')) AS value 
               UNION ALL
               SELECT
                  'filter',
                  JSON_UNQUOTE(JSON_EXTRACT(json, '$.chartDetails.filter')) 
               UNION ALL
               SELECT
                  'function',
                  JSON_UNQUOTE(JSON_EXTRACT(json, '$.chartDetails.function')) 
               UNION ALL
               SELECT
                  'field',
                  JSON_UNQUOTE(JSON_EXTRACT(json, '$.chartDetails.field')) 
               UNION ALL
               SELECT
                  'treeFilter',
                  JSON_UNQUOTE(JSON_EXTRACT(json, '$.chartDetails.treeFilter')) 
            )
            AS temp 
         WHERE
            value IS NOT NULL 
      )
      as demo) ) ) 
   WHERE
      JSON_EXTRACT(json, '$.chartDetails.type') = 'LineChart'
      and JSON_EXTRACT(json, '$.chartDetails.metrics') is NULL;

-- Rename 'offset' to 'currentOffset' and add 'startingOffset'
UPDATE change_event_consumers
SET json = JSON_SET(
    JSON_REMOVE(json, '$.offset'),
    '$.currentOffset', JSON_EXTRACT(json, '$.offset'),
    '$.startingOffset', JSON_EXTRACT(json, '$.offset')
)
WHERE JSON_EXTRACT(json, '$.offset') IS NOT NULL
  AND jsonSchema = 'eventSubscriptionOffset';

-- Create table successful_sent_change_events for storing successfully sent events per alert
CREATE TABLE IF NOT EXISTS successful_sent_change_events (
    id VARCHAR(36) NOT NULL,
    change_event_id VARCHAR(36) NOT NULL,
    event_subscription_id VARCHAR(36) NOT NULL,
    json JSON NOT NULL,
    timestamp BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (id)
);

-- Create an index on the event_subscription_id column in the successful_sent_change_events table
CREATE INDEX idx_event_subscription_id ON successful_sent_change_events (event_subscription_id);

-- Remove Override View Lineage
UPDATE ingestion_pipeline_entity
SET json = JSON_REMOVE(json, '$.sourceConfig.config.overrideViewLineage')
WHERE JSON_EXTRACT(json, '$.pipelineType') = 'metadata';
