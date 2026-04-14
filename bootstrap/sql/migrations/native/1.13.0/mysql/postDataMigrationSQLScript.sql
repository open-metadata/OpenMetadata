UPDATE ingestion_pipeline_entity
SET json = JSON_REMOVE(json, '$.sourceConfig.config.computeMetrics')
WHERE JSON_EXTRACT(json, '$.sourceConfig.config.computeMetrics') IS NOT NULL
AND pipelineType = 'profiler';

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

-- Add Container permissions to AutoClassificationBotPolicy for storage auto-classification support
UPDATE policy_entity
SET json = JSON_ARRAY_INSERT(
    json,
    '$.rules[1]',
    JSON_OBJECT(
        'name', 'AutoClassificationBotRule-Allow-Container',
        'description', 'Allow adding tags and sample data to the containers',
        'resources', JSON_ARRAY('Container'),
        'operations', JSON_ARRAY('EditAll', 'ViewAll'),
        'effect', 'allow'
    )
)
WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.name')) = 'AutoClassificationBotPolicy'
  AND JSON_EXTRACT(json, '$.rules[1].name') != 'AutoClassificationBotRule-Allow-Container';
