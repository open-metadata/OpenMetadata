-- Update ingestion_pipeline_entity to add dbServicePrefixes and remove dbServiceNames
UPDATE
  ingestion_pipeline_entity
SET
  json = JSON_SET(
    JSON_REMOVE(
      json,
      '$.sourceConfig.config.lineageInformation.dbServiceNames'
    ),
    '$.sourceConfig.config.lineageInformation.dbServicePrefixes',
    JSON_EXTRACT(
      json,
      '$.sourceConfig.config.lineageInformation.dbServiceNames'
    )
  )
WHERE
  JSON_EXTRACT(json, '$.sourceConfig.config.type') = 'DashboardMetadata'
  AND JSON_CONTAINS_PATH(
    json,
    'one',
    '$.sourceConfig.config.lineageInformation.dbServiceNames'
  );