-- Migrate OpenLineage connection config: move Kafka-specific fields into brokerConfig
-- Supports the schema change adding Kinesis as an alternative broker type
UPDATE pipeline_service_entity
SET json = jsonb_set(
    json,
    '{connection,config,brokerConfig}',
    (json #> '{connection,config}') - 'type' - 'pipelineFilterPattern' - 'supportsMetadataExtraction',
    true
)
#- '{connection,config,brokersUrl}'
#- '{connection,config,topicName}'
#- '{connection,config,consumerGroupName}'
#- '{connection,config,consumerOffsets}'
#- '{connection,config,poolTimeout}'
#- '{connection,config,sessionTimeout}'
#- '{connection,config,securityProtocol}'
#- '{connection,config,sslConfig}'
#- '{connection,config,saslConfig}'
WHERE serviceType = 'OpenLineage'
  AND jsonb_exists(json #> '{connection,config}', 'brokersUrl')
  AND NOT jsonb_exists(json #> '{connection,config}', 'brokerConfig');

-- Rename 'preview' to 'enabled' in apps, inverting the boolean value
-- preview=false (can be used) becomes enabled=true, preview=true becomes enabled=false
UPDATE apps_marketplace
SET json = (json - 'preview') || jsonb_build_object(
    'enabled',
    CASE
        WHEN json -> 'preview' = 'null'::jsonb THEN true
        WHEN (json -> 'preview')::boolean = true THEN false
        ELSE true
    END
)
WHERE json ? 'preview';

UPDATE installed_apps
SET json = (json - 'preview') || jsonb_build_object(
    'enabled',
    CASE
        WHEN json -> 'preview' = 'null'::jsonb THEN true
        WHEN (json -> 'preview')::boolean = true THEN false
        ELSE true
    END
)
WHERE json ? 'preview';
