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

-- Rename 'preview' to 'enabled' in apps, inverting the boolean value
-- preview=false (can be used) becomes enabled=true, preview=true becomes enabled=false
UPDATE apps_marketplace
SET json = JSON_SET(
    JSON_REMOVE(json, '$.preview'),
    '$.enabled',
    CASE
        WHEN JSON_EXTRACT(json, '$.preview') = true THEN CAST('false' AS JSON)
        ELSE CAST('true' AS JSON)
    END
)
WHERE JSON_CONTAINS_PATH(json, 'one', '$.preview');

UPDATE installed_apps
SET json = JSON_SET(
    JSON_REMOVE(json, '$.preview'),
    '$.enabled',
    CASE
        WHEN JSON_EXTRACT(json, '$.preview') = true THEN CAST('false' AS JSON)
        ELSE CAST('true' AS JSON)
    END
)
WHERE JSON_CONTAINS_PATH(json, 'one', '$.preview');
