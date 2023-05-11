-- Updating the value of SASL Mechanism for Kafka and Redpanda connections
UPDATE messaging_service_entity
SET json = JSON_REPLACE(json, '$.connection.config.saslMechanism', 'PLAIN')
WHERE (serviceType = 'Kafka' OR serviceType = 'Redpanda')
  AND JSON_EXTRACT(json, '$.connection.config.saslMechanism') IS NOT NULL
  AND JSON_EXTRACT(json, '$.connection.config.saslMechanism') NOT IN ('GSSAPI', 'PLAIN', 'SCRAM-SHA-256', 'SCRAM-SHA-512', 'OAUTHBEARER');

-- Remove the Subscriptions
DELETE FROM event_subscription_entity;

-- Clean old test connections
TRUNCATE automations_workflow;
