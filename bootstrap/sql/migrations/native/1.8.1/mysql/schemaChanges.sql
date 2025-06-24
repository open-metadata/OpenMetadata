-- Add generated columns for lastLoginTime and lastActivityTime to user_entity table for efficient querying of online users
ALTER TABLE user_entity 
ADD COLUMN lastLoginTime BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.lastLoginTime'))) VIRTUAL;

ALTER TABLE user_entity 
ADD COLUMN lastActivityTime BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.lastActivityTime'))) VIRTUAL;

CREATE INDEX idx_user_entity_last_login_time ON user_entity(lastLoginTime);
CREATE INDEX idx_user_entity_last_activity_time ON user_entity(lastActivityTime);
CREATE INDEX idx_user_entity_last_login_deleted ON user_entity(lastLoginTime, deleted);
CREATE INDEX idx_user_entity_last_activity_deleted ON user_entity(lastActivityTime, deleted);