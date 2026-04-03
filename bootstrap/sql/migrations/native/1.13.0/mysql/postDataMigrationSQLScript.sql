UPDATE ingestion_pipeline_entity
SET json = JSON_REMOVE(json, '$.sourceConfig.config.computeMetrics')
WHERE JSON_EXTRACT(json, '$.sourceConfig.config.computeMetrics') IS NOT NULL
AND pipelineType = 'profiler';

-- Set randomizedSample to false where it was true (old default behavior)
UPDATE ingestion_pipeline_entity
SET json = JSON_SET(json, '$.sourceConfig.config.randomizedSample', false)
WHERE JSON_EXTRACT(json, '$.sourceConfig.config.randomizedSample') = true
AND pipelineType = 'profiler';

UPDATE table_entity
SET json = JSON_SET(json, '$.tableProfilerConfig.randomizedSample', false)
WHERE JSON_EXTRACT(json, '$.tableProfilerConfig.randomizedSample') = true;

UPDATE database_entity
SET json = JSON_SET(json, '$.databaseProfilerConfig.randomizedSample', false)
WHERE JSON_EXTRACT(json, '$.databaseProfilerConfig.randomizedSample') = true;

UPDATE database_schema_entity
SET json = JSON_SET(json, '$.databaseSchemaProfilerConfig.randomizedSample', false)
WHERE JSON_EXTRACT(json, '$.databaseSchemaProfilerConfig.randomizedSample') = true;
