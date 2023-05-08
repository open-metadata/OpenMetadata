-- Updating the value of SASL Mechanism for Kafka and Redpanda connections
UPDATE messaging_service_entity
SET json = JSONB_SET(json::jsonb, '{connection,config,saslMechanism}', '"PLAIN"')
WHERE (servicetype = 'Kafka' OR serviceType = 'Redpanda')
  AND json#>'{connection,config,saslMechanism}' IS NOT NULL
  AND json#>'{connection,config,saslMechanism}' NOT IN ('"GSSAPI"', '"PLAIN"', '"SCRAM-SHA-256"', '"SCRAM-SHA-512"', '"OAUTHBEARER"');

-- Update DynamoDB Test Connection step
UPDATE test_connection_definition
SET json = JSONB_SET(json::jsonb, '{steps, 0, name}', '"ListTables"')
WHERE name = 'DynamoDB';
