ALTER TABLE user_entity
ADD COLUMN lastLoginTime BIGINT GENERATED ALWAYS AS ((json->>'lastLoginTime')::bigint) STORED;

ALTER TABLE user_entity 
ADD COLUMN lastActivityTime BIGINT GENERATED ALWAYS AS ((json->>'lastActivityTime')::bigint) STORED;


CREATE INDEX idx_user_entity_last_login_time ON user_entity(lastLoginTime);
CREATE INDEX idx_user_entity_last_activity_time ON user_entity(lastActivityTime);
CREATE INDEX idx_user_entity_last_login_deleted ON user_entity(lastLoginTime, deleted);
CREATE INDEX idx_user_entity_last_activity_deleted ON user_entity(lastActivityTime, deleted);