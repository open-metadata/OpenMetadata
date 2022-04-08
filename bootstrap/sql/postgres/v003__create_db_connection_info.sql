CREATE TABLE IF NOT EXISTS webhook_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    json JSON NOT NULL,
    PRIMARY KEY (id),
    UNIQUE(name)
    -- No versioning, updatedAt, updatedBy, or changeDescription fields for webhook
);

UPDATE change_event
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))); --JSON_SET(json, 'timestamp', UNIX_TIMESTAMP(STR_TO_DATE(json ->> 'dateTime', '%Y-%m-%dT%T.%fZ')));

ALTER TABLE change_event
DROP COLUMN dateTime,
ADD COLUMN eventTime BIGINT GENERATED ALWAYS AS ((json ->> 'timestamp')::bigint) STORED NOT NULL;

UPDATE change_event
SET json = json - 'dateTime';

--
-- Update to add deleted fields to data entities and change updatedAt field to unix epoch time milliseconds
--
ALTER TABLE dbservice_entity
DROP COLUMN updatedAt;

UPDATE dbservice_entity
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))) || jsonb '{"deleted":false}';
UPDATE dbservice_entity
SET json = json - 'jdbc';

ALTER TABLE dbservice_entity
ADD COLUMN updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED;


ALTER TABLE messaging_service_entity
DROP COLUMN updatedAt;

UPDATE messaging_service_entity
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))) || jsonb '{"deleted":false}';

ALTER TABLE messaging_service_entity
ADD COLUMN updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED;


ALTER TABLE dashboard_service_entity
DROP COLUMN updatedAt;

UPDATE dashboard_service_entity
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))) || jsonb '{"deleted":false}';

ALTER TABLE dashboard_service_entity
ADD COLUMN updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED;


ALTER TABLE pipeline_service_entity
DROP COLUMN updatedAt;

UPDATE pipeline_service_entity
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))) || jsonb '{"deleted":false}';

ALTER TABLE pipeline_service_entity
ADD COLUMN updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED;


ALTER TABLE storage_service_entity
DROP COLUMN updatedAt;

UPDATE storage_service_entity
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))) || jsonb '{"deleted":false}';

ALTER TABLE storage_service_entity
ADD COLUMN updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED;


ALTER TABLE database_entity
DROP COLUMN updatedAt;

UPDATE database_entity
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))) || jsonb '{"deleted":false}';

ALTER TABLE database_entity
ADD COLUMN updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED;


ALTER TABLE table_entity
DROP COLUMN updatedAt;

UPDATE table_entity
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))) || jsonb '{"deleted":false}';

ALTER TABLE table_entity
ADD COLUMN updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED;


ALTER TABLE metric_entity
DROP COLUMN updatedAt;

UPDATE metric_entity
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))) || jsonb '{"deleted":false}';

ALTER TABLE metric_entity
ADD COLUMN updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED;


ALTER TABLE report_entity
DROP COLUMN updatedAt;

UPDATE report_entity
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))) || jsonb '{"deleted":false}';

ALTER TABLE report_entity
ADD COLUMN updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED;


ALTER TABLE dashboard_entity
DROP COLUMN updatedAt;

UPDATE dashboard_entity
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))) || jsonb '{"deleted":false}';

ALTER TABLE dashboard_entity
ADD COLUMN updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED;


ALTER TABLE ml_model_entity
DROP COLUMN updatedAt;

UPDATE ml_model_entity
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))) || jsonb '{"deleted":false}';

ALTER TABLE ml_model_entity
ADD COLUMN updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED;


ALTER TABLE pipeline_entity
DROP COLUMN updatedAt;

UPDATE pipeline_entity
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))) || jsonb '{"deleted":false}';

ALTER TABLE pipeline_entity
ADD COLUMN updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED;


ALTER TABLE topic_entity
DROP COLUMN updatedAt;

UPDATE topic_entity
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))) || jsonb '{"deleted":false, "retentionSize": 2147483647}';

ALTER TABLE topic_entity
ADD COLUMN updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED;


ALTER TABLE chart_entity
DROP COLUMN updatedAt;

UPDATE chart_entity
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))) || jsonb '{"deleted":false}';

ALTER TABLE chart_entity
ADD COLUMN updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED;


ALTER TABLE location_entity
DROP COLUMN updatedAt;

UPDATE location_entity
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))) || jsonb '{"deleted":false}';

ALTER TABLE location_entity
ADD COLUMN updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED;


ALTER TABLE bot_entity
DROP COLUMN updatedAt;

UPDATE bot_entity
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))) || jsonb '{"deleted":false}';

ALTER TABLE bot_entity
ADD COLUMN updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED;


ALTER TABLE policy_entity
DROP COLUMN updatedAt;

UPDATE policy_entity
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))) || jsonb '{"deleted":false}';

ALTER TABLE policy_entity
ADD COLUMN updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED;

-- Update entity extension data where we store versions of entities which will have updatedAt in old format.
UPDATE entity_extension
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime')))
where extension like '%.version.%';

ALTER TABLE ingestion_entity
DROP COLUMN updatedAt;

UPDATE ingestion_entity
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))) || jsonb '{"deleted":false}';

ALTER TABLE ingestion_entity
ADD COLUMN updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED;


ALTER TABLE team_entity
DROP COLUMN updatedAt;

UPDATE team_entity
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))) || jsonb '{"deleted":false}';

ALTER TABLE team_entity
ADD COLUMN updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED;


ALTER TABLE role_entity
DROP COLUMN updatedAt;

UPDATE role_entity
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))) || jsonb '{"deleted":false}';

ALTER TABLE role_entity
ADD COLUMN updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED;


ALTER TABLE tag_category
DROP COLUMN updatedAt;

UPDATE tag_category
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))) || jsonb '{"deleted":false}';

ALTER TABLE tag_category
ADD COLUMN updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED;


ALTER TABLE tag
DROP COLUMN updatedAt;

UPDATE tag
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))) || jsonb '{"deleted":false}';

ALTER TABLE tag
ADD COLUMN updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED;

ALTER TABLE entity_relationship
ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- Change "team -- contains --> user" relationship to "team -- has --> user" relationship
UPDATE entity_relationship
SET relation = 10 WHERE fromEntity = 'team' AND toEntity = 'user' AND relation = 0;

-- Change "dashboard -- contains --> chart" relationship to "dashboard -- has --> chart" relationship
UPDATE entity_relationship
SET relation = 10 WHERE fromEntity = 'dashboard' AND toEntity = 'chart' AND relation = 0;

-- Remove user.deactivated field and use deleted instead

ALTER TABLE user_entity
DROP COLUMN updatedAt;

UPDATE user_entity
SET json = json || jsonb_build_object('timestamp', extract(epoch from to_tz_timestamp(json ->> 'dateTime'))) || jsonb '{"deleted":false}' - 'deactivated';

ALTER TABLE user_entity
ADD COLUMN updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED,
DROP COLUMN deactivated,
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED;

-- Rename airflow pipeline entities
--
-- Ingestion related tables
--
DROP TABLE IF EXISTS ingestion_entity;

CREATE TABLE IF NOT EXISTS airflow_pipeline_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE(fullyQualifiedName)
);

