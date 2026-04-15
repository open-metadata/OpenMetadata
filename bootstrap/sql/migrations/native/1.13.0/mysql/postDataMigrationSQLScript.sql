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

-- Hard-delete ingestion pipelines for Iceberg services (must run before service migration)
DELETE ipe FROM ingestion_pipeline_entity ipe
JOIN dbservice_entity dse
  ON JSON_UNQUOTE(JSON_EXTRACT(ipe.json, '$.service.id')) = dse.id
WHERE dse.serviceType = 'Iceberg'
  AND JSON_UNQUOTE(JSON_EXTRACT(ipe.json, '$.service.type')) = 'databaseService';

-- Migrate Iceberg database services to CustomDatabase (connector removed)
-- serviceType is a GENERATED column derived from json, so only update json
UPDATE dbservice_entity
SET json = JSON_SET(
      json,
      '$.serviceType', 'CustomDatabase',
      '$.connection.config.type', 'CustomDatabase'
    )
WHERE serviceType = 'Iceberg';

-- Migrate serviceType in child entities (serviceType is in JSON blob only, no generated column)
UPDATE database_entity
SET json = JSON_SET(json, '$.serviceType', 'CustomDatabase')
WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.serviceType')) = 'Iceberg';

UPDATE database_schema_entity
SET json = JSON_SET(json, '$.serviceType', 'CustomDatabase')
WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.serviceType')) = 'Iceberg';

UPDATE table_entity
SET json = JSON_SET(json, '$.serviceType', 'CustomDatabase')
WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.serviceType')) = 'Iceberg';

UPDATE stored_procedure_entity
SET json = JSON_SET(json, '$.serviceType', 'CustomDatabase')
WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.serviceType')) = 'Iceberg';
