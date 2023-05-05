-- Updating the value of SASL Mechanism for Kafka and Redpanda connections
UPDATE messaging_service_entity
SET json = JSONB_SET(json::jsonb, '{connection,config,saslMechanism}', '"PLAIN"')
WHERE (servicetype = 'Kafka' OR serviceType = 'Redpanda')
  AND json#>'{connection,config,saslMechanism}' IS NOT NULL
  AND json#>'{connection,config,saslMechanism}' NOT IN ('"GSSAPI"', '"PLAIN"', '"SCRAM-SHA-256"', '"SCRAM-SHA-512"', '"OAUTHBEARER"');