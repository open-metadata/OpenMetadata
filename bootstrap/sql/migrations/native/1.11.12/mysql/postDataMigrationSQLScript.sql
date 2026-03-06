-- Migrate OpenLineage connection config: move Kafka-specific fields into brokerConfig
-- Supports the schema change adding Kinesis as an alternative broker type
UPDATE pipeline_service_entity
SET json = JSON_SET(
    JSON_REMOVE(json,
        '$.connection.config.brokersUrl',
        '$.connection.config.topicName',
        '$.connection.config.consumerGroupName',
        '$.connection.config.consumerOffsets',
        '$.connection.config.poolTimeout',
        '$.connection.config.sessionTimeout',
        '$.connection.config.securityProtocol',
        '$.connection.config.sslConfig',
        '$.connection.config.saslConfig'
    ),
    '$.connection.config.brokerConfig',
    JSON_REMOVE(
        JSON_EXTRACT(json, '$.connection.config'),
        '$.type',
        '$.pipelineFilterPattern',
        '$.supportsMetadataExtraction'
    )
)
WHERE serviceType = 'OpenLineage'
  AND JSON_CONTAINS_PATH(json, 'one', '$.connection.config.brokersUrl')
  AND NOT JSON_CONTAINS_PATH(json, 'one', '$.connection.config.brokerConfig');
