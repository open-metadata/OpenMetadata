-- Add the supportsProfiler field to the MongoDB connection configuration
UPDATE dbservice_entity
SET json = JSON_INSERT(json, '$.connection.config.supportsProfiler', TRUE)
WHERE serviceType = 'MongoDB';