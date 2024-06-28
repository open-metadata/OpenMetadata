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
