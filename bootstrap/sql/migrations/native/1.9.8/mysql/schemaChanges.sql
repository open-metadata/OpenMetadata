-- Modify the path to the auto-generated operation column to extract from the JSON field
ALTER TABLE profiler_data_time_series
MODIFY COLUMN operation VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.profileData.operation') NULL;

 -- Add unexecuted migrations for user_activity in version 1.8.1
ALTER TABLE user_entity
ADD COLUMN lastLoginTime BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.lastLoginTime'))) VIRTUAL;

ALTER TABLE user_entity
ADD COLUMN lastActivityTime BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.lastActivityTime'))) VIRTUAL;

CREATE INDEX idx_user_entity_last_login_time ON user_entity(lastLoginTime);
CREATE INDEX idx_user_entity_last_activity_time ON user_entity(lastActivityTime);
CREATE INDEX idx_user_entity_last_login_deleted ON user_entity(lastLoginTime, deleted);
CREATE INDEX idx_user_entity_last_activity_deleted ON user_entity(lastActivityTime, deleted);