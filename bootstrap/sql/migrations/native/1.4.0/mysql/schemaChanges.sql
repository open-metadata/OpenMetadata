-- Add the supportsProfiler field to the MongoDB connection configuration
UPDATE dbservice_entity
SET json = JSON_INSERT(json, '$.connection.config.supportsProfiler', TRUE)
WHERE serviceType = 'MongoDB';

ALTER TABLE query_entity ADD COLUMN checksum VARCHAR(32) GENERATED ALWAYS AS (json ->> '$.checksum') NOT NULL UNIQUE;

UPDATE query_entity SET json = JSON_INSERT(json, '$.checksum', MD5(JSON_UNQUOTE(JSON_EXTRACT(json, '$.checksum'))));

-- Restructure dbServiceNames in ingestion_pipeline_entity
update ingestion_pipeline_entity set json = 
  JSON_INSERT(
    JSON_REMOVE(json, '$.sourceConfig.config.dbServiceNames'), 
    '$.sourceConfig.config.lineageInformation', 
    JSON_OBJECT(
      'dbServiceNames', 
      JSON_EXTRACT(json, '$.sourceConfig.config.dbServiceNames')
    )
  )
where 	
  JSON_EXTRACT(json, '$.sourceConfig.config.type') in ('DashboardMetadata', 'PipelineMetadata')
  AND JSON_EXTRACT(json, '$.sourceConfig.config.dbServiceNames') is not null;
