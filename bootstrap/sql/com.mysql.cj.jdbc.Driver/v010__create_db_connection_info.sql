-- Updating the value of SASL Mechanism for Kafka and Redpanda connections
UPDATE messaging_service_entity
SET json = JSON_REPLACE(json, '$.connection.config.saslMechanism', 'PLAIN')
WHERE (serviceType = 'Kafka' OR serviceType = 'Redpanda')
  AND JSON_EXTRACT(json, '$.connection.config.saslMechanism') IS NOT NULL
  AND JSON_EXTRACT(json, '$.connection.config.saslMechanism') NOT IN ('GSSAPI', 'PLAIN', 'SCRAM-SHA-256', 'SCRAM-SHA-512', 'OAUTHBEARER');


-- Update DynamoDB Test Connection step
UPDATE test_connection_definition
SET json = JSON_SET(json, '$.steps[0].name', 'ListTables')
WHERE name = "DynamoDB";