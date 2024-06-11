UPDATE pipeline_service_entity
SET json = JSON_SET(json, '$.connection.config.openlineageConnection', JSON_EXTRACT(json, '$.connection.config'))
WHERE servicetype = 'OpenLineage';

UPDATE pipeline_service_entity
SET json = JSON_REMOVE(json,
                       '$.connection.config.topicName',
                       '$.connection.config.brokersUrl',
                       '$.connection.config.poolTimeout',
                       '$.connection.config.SSLCALocation',
                       '$.connection.config.SSLKeyLocation',
                       '$.connection.config.sessionTimeout',
                       '$.connection.config.consumerOffsets',
                       '$.connection.config.securityProtocol',
                       '$.connection.config.consumerGroupName',
                       '$.connection.config.SSLCertificateLocation',
                       '$.connection.config.openlineageConnection.cleanFinalizedRuns')
WHERE servicetype = 'OpenLineage';


CREATE TABLE `openlineage_events` (
  `id` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) VIRTUAL NOT NULL,
  `eventtype` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.eventtype'))) VIRTUAL NOT NULL,
  `runid` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.runid'))) VIRTUAL NOT NULL,
  `recieved_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` timestamp ,
  `json` json NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;