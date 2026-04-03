UPDATE ingestion_pipeline_entity
SET json = (json::jsonb #- '{sourceConfig,config,computeMetrics}')::json
WHERE json::jsonb -> 'sourceConfig' -> 'config' -> 'computeMetrics' IS NOT NULL
AND pipelineType = 'profiler';

-- Set randomizedSample to false where it was true (old default behavior)
UPDATE ingestion_pipeline_entity
SET json = jsonb_set(json::jsonb, '{sourceConfig,config,randomizedSample}', 'false'::jsonb)::json
WHERE json::jsonb #>> '{sourceConfig,config,randomizedSample}' = 'true'
AND pipelineType = 'profiler';

UPDATE table_entity
SET json = jsonb_set(json::jsonb, '{tableProfilerConfig,randomizedSample}', 'false'::jsonb)::json
WHERE json::jsonb #>> '{tableProfilerConfig,randomizedSample}' = 'true';

UPDATE database_entity
SET json = jsonb_set(json::jsonb, '{databaseProfilerConfig,randomizedSample}', 'false'::jsonb)::json
WHERE json::jsonb #>> '{databaseProfilerConfig,randomizedSample}' = 'true';

UPDATE database_schema_entity
SET json = jsonb_set(json::jsonb, '{databaseSchemaProfilerConfig,randomizedSample}', 'false'::jsonb)::json
WHERE json::jsonb #>> '{databaseSchemaProfilerConfig,randomizedSample}' = 'true';
