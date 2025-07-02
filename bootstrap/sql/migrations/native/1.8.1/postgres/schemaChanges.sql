ALTER TABLE user_entity
ADD COLUMN lastLoginTime BIGINT GENERATED ALWAYS AS ((json->>'lastLoginTime')::bigint) STORED;

ALTER TABLE user_entity 
ADD COLUMN lastActivityTime BIGINT GENERATED ALWAYS AS ((json->>'lastActivityTime')::bigint) STORED;


CREATE INDEX idx_user_entity_last_login_time ON user_entity(lastLoginTime);
CREATE INDEX idx_user_entity_last_activity_time ON user_entity(lastActivityTime);
CREATE INDEX idx_user_entity_last_login_deleted ON user_entity(lastLoginTime, deleted);
CREATE INDEX idx_user_entity_last_activity_deleted ON user_entity(lastActivityTime, deleted);

-- Composite index for apps_extension_time_series to fix query performance
-- Create index only if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_apps_extension_composite 
ON apps_extension_time_series(appId, extension, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_er_toEntity_toId_relation 
ON entity_relationship (toEntity, toId, relation);

CREATE INDEX IF NOT EXISTS idx_er_fromEntity_toEntity 
ON entity_relationship (fromEntity, toEntity);

CREATE INDEX IF NOT EXISTS idx_er_relation_fromEntity_toId 
ON entity_relationship (relation, fromEntity, toId);

