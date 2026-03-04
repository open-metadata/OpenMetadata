-- Remove overrideLineage from DatabaseMetadata pipeline config
UPDATE ingestion_pipeline_entity
SET json = JSON_REMOVE(json, '$.sourceConfig.config.overrideLineage')
WHERE JSON_EXTRACT(json, '$.sourceConfig.config.type') = 'DatabaseMetadata';
