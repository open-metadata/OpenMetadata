-- Remove overrideLineage from DatabaseMetadata pipeline config
UPDATE ingestion_pipeline_entity
SET json = json::jsonb #- '{sourceConfig,config,overrideLineage}'
WHERE json #>> '{sourceConfig,config,type}' = 'DatabaseMetadata';
