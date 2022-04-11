-- DBT models are no longer a separate entity
DROP TABLE IF EXISTS dbt_model_entity;
DELETE FROM entity_relationship WHERE fromEntity='dbtmodel' OR toEntity='dbtmodel';

--
-- Add updatedAt and updatedBy columns for entities that are missing it and index those columns
-- Drop timestamp column from all the tables as they are not used
--
ALTER TABLE location_entity
DROP COLUMN timestamp,
ADD COLUMN updatedAt TIMESTAMP GENERATED ALWAYS AS (TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ'))) NOT NULL AFTER json,
ADD COLUMN updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL AFTER updatedAt,
ADD INDEX (updatedBy),
ADD INDEX (updatedAt);

ALTER TABLE storage_service_entity
DROP COLUMN timestamp,
ADD COLUMN updatedAt TIMESTAMP GENERATED ALWAYS AS (TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ'))) NOT NULL AFTER json,
ADD COLUMN updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL AFTER updatedAt,
ADD INDEX (updatedBy),
ADD INDEX (updatedAt);

ALTER TABLE role_entity
DROP COLUMN timestamp,
ADD COLUMN updatedAt TIMESTAMP GENERATED ALWAYS AS (TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ'))) NOT NULL AFTER json,
ADD COLUMN updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL AFTER updatedAt,
ADD INDEX (updatedBy),
ADD INDEX (updatedAt);

ALTER TABLE entity_relationship DROP COLUMN timestamp;
ALTER TABLE field_relationship DROP COLUMN timestamp;
ALTER TABLE entity_extension DROP COLUMN timestamp;
ALTER TABLE dbservice_entity DROP COLUMN timestamp;
ALTER TABLE messaging_service_entity DROP COLUMN timestamp;
ALTER TABLE dashboard_service_entity DROP COLUMN timestamp;
ALTER TABLE pipeline_service_entity DROP COLUMN timestamp;
ALTER TABLE database_entity DROP COLUMN timestamp;
ALTER TABLE metric_entity DROP COLUMN timestamp;
ALTER TABLE report_entity DROP COLUMN timestamp;
ALTER TABLE dashboard_entity DROP COLUMN timestamp;
ALTER TABLE ml_model_entity DROP COLUMN timestamp;
ALTER TABLE pipeline_entity DROP COLUMN timestamp;
ALTER TABLE topic_entity DROP COLUMN timestamp;
ALTER TABLE chart_entity DROP COLUMN timestamp;
ALTER TABLE thread_entity DROP COLUMN timestamp;
ALTER TABLE policy_entity DROP COLUMN timestamp;
ALTER TABLE ingestion_entity DROP COLUMN timestamp;
ALTER TABLE team_entity DROP COLUMN timestamp;
ALTER TABLE user_entity DROP COLUMN timestamp;
ALTER TABLE bot_entity DROP COLUMN timestamp;
ALTER TABLE tag_category DROP COLUMN timestamp;
ALTER TABLE tag DROP COLUMN timestamp;
ALTER TABLE tag_usage DROP COLUMN timestamp;
