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
  json -> 'chartDetails' -> 'type' = '"LineChart"';
