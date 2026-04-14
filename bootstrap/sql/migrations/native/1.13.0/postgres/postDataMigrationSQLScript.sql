UPDATE ingestion_pipeline_entity
SET json = (json::jsonb #- '{sourceConfig,config,computeMetrics}')::json
WHERE json::jsonb -> 'sourceConfig' -> 'config' -> 'computeMetrics' IS NOT NULL
AND pipelineType = 'profiler';

-- Hard-delete ingestion pipelines for Iceberg services (must run before service migration)
DELETE FROM ingestion_pipeline_entity ipe
USING dbservice_entity dse
WHERE dse.serviceType = 'Iceberg'
  AND ipe.json::jsonb -> 'service' ->> 'type' = 'databaseService'
  AND ipe.json::jsonb -> 'service' ->> 'id' = dse.id;

-- Migrate Iceberg database services to CustomDatabase (connector removed)
-- serviceType is a GENERATED column derived from json, so only update json
UPDATE dbservice_entity
SET json = jsonb_set(
      jsonb_set(
        json::jsonb,
        '{serviceType}', '"CustomDatabase"'
      ),
      '{connection,config,type}', '"CustomDatabase"'
    )::json
WHERE serviceType = 'Iceberg';

-- Migrate serviceType in child entities (serviceType is in JSON blob only, no generated column)
UPDATE database_entity
SET json = jsonb_set(json::jsonb, '{serviceType}', '"CustomDatabase"')::json
WHERE json->>'serviceType' = 'Iceberg';

UPDATE database_schema_entity
SET json = jsonb_set(json::jsonb, '{serviceType}', '"CustomDatabase"')::json
WHERE json->>'serviceType' = 'Iceberg';

UPDATE table_entity
SET json = jsonb_set(json::jsonb, '{serviceType}', '"CustomDatabase"')::json
WHERE json->>'serviceType' = 'Iceberg';

UPDATE stored_procedure_entity
SET json = jsonb_set(json::jsonb, '{serviceType}', '"CustomDatabase"')::json
WHERE json->>'serviceType' = 'Iceberg';