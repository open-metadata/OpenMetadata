-- Add the supportsProfiler field to the MongoDB connection configuration
UPDATE dbservice_entity
SET json = jsonb_set(json::jsonb, '{connection,config,supportsProfiler}', 'true'::jsonb)
WHERE serviceType = 'MongoDB';

ALTER TABLE query_entity ADD COLUMN checksum varchar(32) GENERATED ALWAYS AS (json ->> 'checksum') STORED NOT NULL,
    ADD UNIQUE(checksum);

UPDATE query_entity SET json = jsonb_set(json::jsonb, '{checksum}', MD5(json->'connection'));

-- Restructure dbServiceNames in ingestion_pipeline_entity
update ingestion_pipeline_entity ipe set json = JSONB_SET(
    json::jsonb #- '{sourceConfig,config,dbServiceNames}',
    '{sourceConfig,config,lineageInformation}',
    jsonb_build_object(
        'dbServiceNames',
        json#>'{sourceConfig,config,dbServiceNames}'
    )
)
WHERE (json#>'{sourceConfig,config,type}')::varchar(255) IN ('"DashboardMetadata"', '"PipelineMetadata"') 
and json#>'{sourceConfig,config,dbServiceNames}' is not null;
