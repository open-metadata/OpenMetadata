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
