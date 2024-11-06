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
