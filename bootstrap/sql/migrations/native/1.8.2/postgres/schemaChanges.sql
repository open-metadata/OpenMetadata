-- Update ingestion_pipeline_entity to add dbServicePrefixes and remove dbServiceNames
UPDATE
  ingestion_pipeline_entity
SET
  json = jsonb_set(
    json :: jsonb,
    '{sourceConfig,config,lineageInformation}',
    (
      (
        json :: jsonb -> 'sourceConfig' -> 'config' -> 'lineageInformation'
      ) - 'dbServiceNames' || jsonb_build_object(
        'dbServicePrefixes',
        json :: jsonb -> 'sourceConfig' -> 'config' -> 'lineageInformation' -> 'dbServiceNames'
      )
    )
  )
WHERE
  json :: jsonb -> 'sourceConfig' -> 'config' ->> 'type' = 'DashboardMetadata'
  AND jsonb_exists(
    json :: jsonb -> 'sourceConfig' -> 'config' -> 'lineageInformation',
    'dbServiceNames'
  );