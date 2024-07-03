-- Add a new table di_chart_entity
CREATE TABLE IF NOT EXISTS di_chart_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.fullyQualifiedName') NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    fqnHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted'),
    UNIQUE(name),
    INDEX name_index (name)
);

-- Update the KPI entity to remove the targetDefinition and set the targetValue to the value of the targetDefinition
UPDATE kpi_entity
SET json = JSON_REMOVE(
                    JSON_SET(json, 
                             '$.targetValue', 
                             CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.targetDefinition[0].value')) AS DECIMAL) * 100 
                            ),
                    '$.targetDefinition'
                )
WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.metricType')) = 'PERCENTAGE';

UPDATE kpi_entity
SET json = JSON_REMOVE(
                    JSON_SET(json, 
                             '$.targetValue', 
                             CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.targetDefinition[0].value')) AS DECIMAL) 
                            ),
                    '$.targetDefinition'
                )
WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.metricType')) = 'NUMBER';
-- Update DeltaLake service due to connection schema changes to enable DeltaLake ingestion from Storage
UPDATE dbservice_entity dbse
SET
  dbse.json = JSON_REMOVE(JSON_REMOVE(
  JSON_MERGE_PATCH(
    dbse.json,
    JSON_OBJECT(
      'connection', JSON_OBJECT(
        'config', JSON_OBJECT(
          'configSource', JSON_OBJECT(
            'connection', JSON_EXTRACT(dbse.json, '$.connection.config.metastoreConnection'),
            'appName', JSON_UNQUOTE(JSON_EXTRACT(dbse.json, '$.connection.config.appName'))
          )
        )
      )
    )
  )
  , '$.connection.config.appName'), '$.connection.config.metastoreConnection')
WHERE dbse.serviceType = 'DeltaLake';
