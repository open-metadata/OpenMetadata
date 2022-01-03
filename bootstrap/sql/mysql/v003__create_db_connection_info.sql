CREATE TABLE IF NOT EXISTS webhook_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
    json JSON NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(name)
    -- No versioning, updatedAt, updatedBy, or changeDescription fields for webhook
);

--
-- Change timestamp column precision to include microseconds
--
ALTER TABLE change_event
DROP INDEX dateTime,
DROP COLUMN dateTime,
ADD COLUMN dateTime TIMESTAMP(6) GENERATED ALWAYS AS (STR_TO_DATE(json ->> '$.dateTime', '%Y-%m-%dT%T.%fZ')) NOT NULL
AFTER username,
ADD INDEX (dateTime);


--
-- Update to add deleted fields to data entities
--
ALTER TABLE dbservice_entity
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);

ALTER TABLE messaging_service_entity
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);

ALTER TABLE dashboard_service_entity
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);

ALTER TABLE pipeline_service_entity
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);

ALTER TABLE storage_service_entity
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);

ALTER TABLE database_entity
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);

ALTER TABLE table_entity
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);

ALTER TABLE metric_entity
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);

ALTER TABLE report_entity
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);

ALTER TABLE dashboard_entity
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);

ALTER TABLE ml_model_entity
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);

ALTER TABLE pipeline_entity
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);

ALTER TABLE topic_entity
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);

ALTER TABLE chart_entity
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);

ALTER TABLE location_entity
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);

ALTER TABLE bot_entity
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);

ALTER TABLE policy_entity
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);

ALTER TABLE ingestion_entity
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);

ALTER TABLE team_entity
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);

ALTER TABLE entity_relationship
ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT 0,
ADD INDEX (deleted);

-- Change "team -- contains --> user" relationship to "team -- has --> user" relationship
UPDATE entity_relationship
SET relation = 10 WHERE fromEntity = 'team' AND toEntity = 'user' AND relation = 0;

-- Change "dashboard -- contains --> chart" relationship to "dashboard -- has --> chart" relationship
UPDATE entity_relationship
SET relation = 10 WHERE fromEntity = 'dashboard' AND toEntity = 'chart' AND relation = 0;

-- Remove user.deactivated field and use deleted instead
UPDATE user_entity
SET json = JSON_REMOVE(user_entity.json, '$.deactivated');

ALTER TABLE user_entity
DROP COLUMN deactivated,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);