-- Add creationTime column to data entities
-- This column stores the creation timestamp of entities in Unix epoch milliseconds

-- Data entities
ALTER TABLE table_entity ADD COLUMN creationTime BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.creationTime'))) VIRTUAL;
ALTER TABLE database_entity ADD COLUMN creationTime BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.creationTime'))) VIRTUAL;
ALTER TABLE database_schema_entity ADD COLUMN creationTime BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.creationTime'))) VIRTUAL;
ALTER TABLE dashboard_entity ADD COLUMN creationTime BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.creationTime'))) VIRTUAL;
ALTER TABLE chart_entity ADD COLUMN creationTime BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.creationTime'))) VIRTUAL;
ALTER TABLE dashboard_data_model_entity ADD COLUMN creationTime BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.creationTime'))) VIRTUAL;
ALTER TABLE pipeline_entity ADD COLUMN creationTime BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.creationTime'))) VIRTUAL;
ALTER TABLE topic_entity ADD COLUMN creationTime BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.creationTime'))) VIRTUAL;
ALTER TABLE ml_model_entity ADD COLUMN creationTime BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.creationTime'))) VIRTUAL;
ALTER TABLE storage_container_entity ADD COLUMN creationTime BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.creationTime'))) VIRTUAL;
ALTER TABLE metric_entity ADD COLUMN creationTime BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.creationTime'))) VIRTUAL;
ALTER TABLE query_entity ADD COLUMN creationTime BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.creationTime'))) VIRTUAL;

-- User/team entities
ALTER TABLE user_entity ADD COLUMN creationTime BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.creationTime'))) VIRTUAL;
ALTER TABLE team_entity ADD COLUMN creationTime BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.creationTime'))) VIRTUAL;
ALTER TABLE role_entity ADD COLUMN creationTime BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.creationTime'))) VIRTUAL;

-- Create indexes for efficient timestamp-based queries
CREATE INDEX idx_table_creation_time ON table_entity (creationTime);
CREATE INDEX idx_database_creation_time ON database_entity (creationTime);
CREATE INDEX idx_dashboard_creation_time ON dashboard_entity (creationTime);
CREATE INDEX idx_pipeline_creation_time ON pipeline_entity (creationTime);
CREATE INDEX idx_topic_creation_time ON topic_entity (creationTime);
CREATE INDEX idx_user_creation_time ON user_entity (creationTime);
CREATE INDEX idx_team_creation_time ON team_entity (creationTime);