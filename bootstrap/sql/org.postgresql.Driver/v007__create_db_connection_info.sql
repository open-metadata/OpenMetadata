-- Remove markDeletedTablesFromFilterOnly 
UPDATE ingestion_pipeline_entity
SET json = json::jsonb #- '{sourceConfig,config,markDeletedTablesFromFilterOnly}';