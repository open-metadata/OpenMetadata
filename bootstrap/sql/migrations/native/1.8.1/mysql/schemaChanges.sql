-- Add generated columns for lastLoginTime and lastActivityTime to user_entity table for efficient querying of online users
ALTER TABLE user_entity 
ADD COLUMN lastLoginTime BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.lastLoginTime'))) VIRTUAL;

ALTER TABLE user_entity 
ADD COLUMN lastActivityTime BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.lastActivityTime'))) VIRTUAL;

CREATE INDEX idx_user_entity_last_login_time ON user_entity(lastLoginTime);
CREATE INDEX idx_user_entity_last_activity_time ON user_entity(lastActivityTime);
CREATE INDEX idx_user_entity_last_login_deleted ON user_entity(lastLoginTime, deleted);
CREATE INDEX idx_user_entity_last_activity_deleted ON user_entity(lastActivityTime, deleted);

-- Composite index for apps_extension_time_series to fix "Out of sort memory" error
-- This index optimizes the query: WHERE appId = ? AND extension = ? ORDER BY timestamp DESC
CREATE INDEX idx_apps_extension_composite 
ON apps_extension_time_series(appId, extension, timestamp DESC);

CREATE INDEX idx_er_toEntity_toId_relation
ON entity_relationship (toEntity, toId, relation);

CREATE INDEX idx_er_fromEntity_toEntity 
ON entity_relationship (fromEntity, toEntity);

CREATE INDEX idx_er_relation_fromEntity_toId 
ON entity_relationship (relation, fromEntity, toId);

