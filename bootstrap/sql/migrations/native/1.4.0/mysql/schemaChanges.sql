-- Add the supportsProfiler field to the MongoDB connection configuration
UPDATE dbservice_entity
SET json = JSON_INSERT(json, '$.connection.config.supportsProfiler', TRUE)
WHERE serviceType = 'MongoDB';

ALTER TABLE query_entity ADD COLUMN checksum VARCHAR(32) GENERATED ALWAYS AS (json ->> '$.checksum') NOT NULL UNIQUE;

UPDATE query_entity SET json = JSON_INSERT(json, '$.checksum', MD5(JSON_UNQUOTE(JSON_EXTRACT(json, '$.checksum'))));

UPDATE installed_apps
SET json = JSON_INSERT(
        JSON_REMOVE(json, '$.appSchedule.scheduleType'),
        '$.appSchedule.scheduleTimeline',
        JSON_EXTRACT(json, '$.appSchedule.scheduleType')
    );