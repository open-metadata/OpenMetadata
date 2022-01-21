CREATE TABLE IF NOT EXISTS webhook_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
    json JSON NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(name)
    -- No versioning, updatedAt, updatedBy, or changeDescription fields for webhook
);

UPDATE change_event
SET json = JSON_SET(json, '$.timestamp', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.dateTime', '%Y-%m-%dT%T.%fZ')));

ALTER TABLE change_event
DROP INDEX dateTime,
DROP COLUMN dateTime,
ADD COLUMN eventTime BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.timestamp') NOT NULL AFTER username,
ADD INDEX (eventTime);

UPDATE change_event
SET json = JSON_REMOVE(json, '$.dateTime');

--
-- Update to add deleted fields to data entities and change updatedAt field to unix epoch time milliseconds
--
ALTER TABLE dbservice_entity
DROP COLUMN updatedAt,
DROP INDEX updatedAt;

UPDATE dbservice_entity
SET json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')), '$.deleted', FALSE);

ALTER TABLE dbservice_entity
ADD COLUMN updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL AFTER json,
ADD INDEX(updatedAt),
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);


ALTER TABLE messaging_service_entity
DROP COLUMN updatedAt,
DROP INDEX updatedAt;

UPDATE messaging_service_entity
SET json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')), '$.deleted', FALSE);

ALTER TABLE messaging_service_entity
ADD COLUMN updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL AFTER json,
ADD INDEX(updatedAt),
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);


ALTER TABLE dashboard_service_entity
DROP COLUMN updatedAt,
DROP INDEX updatedAt;

UPDATE dashboard_service_entity
SET json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')), '$.deleted', FALSE);

ALTER TABLE dashboard_service_entity
ADD COLUMN updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL AFTER json,
ADD INDEX(updatedAt),
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);


ALTER TABLE pipeline_service_entity
DROP COLUMN updatedAt,
DROP INDEX updatedAt;

UPDATE pipeline_service_entity
SET json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')), '$.deleted', FALSE);

ALTER TABLE pipeline_service_entity
ADD COLUMN updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL AFTER json,
ADD INDEX(updatedAt),
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);


ALTER TABLE storage_service_entity
DROP COLUMN updatedAt,
DROP INDEX updatedAt;

UPDATE storage_service_entity
SET json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')), '$.deleted', FALSE);

ALTER TABLE storage_service_entity
ADD COLUMN updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL AFTER json,
ADD INDEX(updatedAt),
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);


ALTER TABLE database_entity
DROP COLUMN updatedAt,
DROP INDEX updatedAt;

UPDATE database_entity
SET json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')), '$.deleted', FALSE);

ALTER TABLE database_entity
ADD COLUMN updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL AFTER json,
ADD INDEX(updatedAt),
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);


ALTER TABLE table_entity
DROP COLUMN updatedAt,
DROP INDEX updatedAt;

UPDATE table_entity
SET json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')), '$.deleted', FALSE);

ALTER TABLE table_entity
ADD COLUMN updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL AFTER json,
ADD INDEX(updatedAt),
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);


ALTER TABLE metric_entity
DROP COLUMN updatedAt,
DROP INDEX updatedAt;

UPDATE metric_entity
SET json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')), '$.deleted', FALSE);

ALTER TABLE metric_entity
ADD COLUMN updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL AFTER json,
ADD INDEX(updatedAt),
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);


ALTER TABLE report_entity
DROP COLUMN updatedAt,
DROP INDEX updatedAt;

UPDATE report_entity
SET json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')), '$.deleted', FALSE);

ALTER TABLE report_entity
ADD COLUMN updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL AFTER json,
ADD INDEX(updatedAt),
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);


ALTER TABLE dashboard_entity
DROP COLUMN updatedAt,
DROP INDEX updatedAt;

UPDATE dashboard_entity
SET json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')), '$.deleted', FALSE);

ALTER TABLE dashboard_entity
ADD COLUMN updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL AFTER json,
ADD INDEX(updatedAt),
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);


ALTER TABLE ml_model_entity
DROP COLUMN updatedAt,
DROP INDEX updatedAt;

UPDATE ml_model_entity
SET json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')), '$.deleted', FALSE);

ALTER TABLE ml_model_entity
ADD COLUMN updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL AFTER json,
ADD INDEX(updatedAt),
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);


ALTER TABLE pipeline_entity
DROP COLUMN updatedAt,
DROP INDEX updatedAt;

UPDATE pipeline_entity
SET json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')), '$.deleted', FALSE);

ALTER TABLE pipeline_entity
ADD COLUMN updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL AFTER json,
ADD INDEX(updatedAt),
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);


ALTER TABLE topic_entity
DROP COLUMN updatedAt,
DROP INDEX updatedAt;

UPDATE topic_entity
SET json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')), '$.deleted', FALSE, '$.retentionSize', 2147483647);

ALTER TABLE topic_entity
ADD COLUMN updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL AFTER json,
ADD INDEX(updatedAt),
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);


ALTER TABLE chart_entity
DROP COLUMN updatedAt,
DROP INDEX updatedAt;

UPDATE chart_entity
SET json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')), '$.deleted', FALSE);

ALTER TABLE chart_entity
ADD COLUMN updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL AFTER json,
ADD INDEX(updatedAt),
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);


ALTER TABLE location_entity
DROP COLUMN updatedAt,
DROP INDEX updatedAt;

UPDATE location_entity
SET json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')), '$.deleted', FALSE);

ALTER TABLE location_entity
ADD COLUMN updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL AFTER json,
ADD INDEX(updatedAt),
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);


ALTER TABLE bot_entity
DROP COLUMN updatedAt,
DROP INDEX updatedAt;

UPDATE bot_entity
SET json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')), '$.deleted', FALSE);

ALTER TABLE bot_entity
ADD COLUMN updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL AFTER json,
ADD INDEX(updatedAt),
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);


ALTER TABLE policy_entity
DROP COLUMN updatedAt,
DROP INDEX updatedAt;

UPDATE policy_entity
SET json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')), '$.deleted', FALSE);

ALTER TABLE policy_entity
ADD COLUMN updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL AFTER json,
ADD INDEX(updatedAt),
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);

UPDATE entity_extension
SET json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')));


ALTER TABLE ingestion_entity
DROP COLUMN updatedAt,
DROP INDEX updatedAt;

UPDATE ingestion_entity
SET json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')), '$.deleted', FALSE);

ALTER TABLE ingestion_entity
ADD COLUMN updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL AFTER json,
ADD INDEX(updatedAt),
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);


ALTER TABLE team_entity
DROP COLUMN updatedAt,
DROP INDEX updatedAt;

UPDATE team_entity
SET json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')), '$.deleted', FALSE);

ALTER TABLE team_entity
ADD COLUMN updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL AFTER json,
ADD INDEX(updatedAt),
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);


ALTER TABLE role_entity
DROP COLUMN updatedAt,
DROP INDEX updatedAt;

UPDATE role_entity
SET json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')), '$.deleted', FALSE);

ALTER TABLE role_entity
ADD COLUMN updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL AFTER json,
ADD INDEX(updatedAt),
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);


ALTER TABLE tag_category
DROP COLUMN updatedAt,
DROP INDEX updatedAt;

UPDATE tag_category
SET json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')), '$.deleted', FALSE);

ALTER TABLE tag_category
ADD COLUMN updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL AFTER json,
ADD INDEX(updatedAt),
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);


ALTER TABLE tag
DROP COLUMN updatedAt,
DROP INDEX updatedAt;

UPDATE tag
SET json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')), '$.deleted', FALSE);

ALTER TABLE tag
ADD COLUMN updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL AFTER json,
ADD INDEX(updatedAt),
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

ALTER TABLE user_entity
DROP COLUMN updatedAt,
DROP INDEX updatedAt;

UPDATE user_entity
SET json = JSON_REMOVE(user_entity.json, '$.deactivated'),
json = JSON_SET(json, '$.updatedAt', UNIX_TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ')), '$.deleted', FALSE);

ALTER TABLE user_entity
ADD COLUMN updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL AFTER json,
ADD INDEX(updatedAt),
DROP COLUMN deactivated,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);

