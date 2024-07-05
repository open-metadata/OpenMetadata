-- Update DeltaLake service due to connection schema changes to enable DeltaLake ingestion from Storage
UPDATE dbservice_entity
SET json = JSONB_SET(
  JSONB_SET(
    json,
    '{connection,config,configSource}',
    JSONB_BUILD_OBJECT('connection', json->'connection'->'config'->'metastoreConnection')
  ),
  '{connection,config,configSource,appName}',
  json->'connection'->'config'->'appName'
) #- '{connection,config,metastoreConnection}' #- '{connection,config,appName}'
WHERE serviceType = 'DeltaLake';

-- Allow all bots to update the ingestion pipeline status
UPDATE policy_entity
SET json = jsonb_set(
  json,
  '{rules}',
  (json->'rules')::jsonb || to_jsonb(ARRAY[
    jsonb_build_object(
      'name', 'BotRule-IngestionPipeline',
      'description', 'A bot can Edit ingestion pipelines to pass the status',
      'resources', jsonb_build_array('ingestionPipeline'),
      'operations', jsonb_build_array('ViewAll', 'EditAll'),
      'effect', 'allow'
    )
  ]),
  true
)
WHERE json->>'name' = 'DefaultBotPolicy';
