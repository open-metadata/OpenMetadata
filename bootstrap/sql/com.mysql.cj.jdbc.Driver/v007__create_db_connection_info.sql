-- Remove markDeletedTablesFromFilterOnly 
UPDATE ingestion_pipeline_entity
SET json = JSON_REMOVE(json ,'$.sourceConfig.config.markDeletedTablesFromFilterOnly');