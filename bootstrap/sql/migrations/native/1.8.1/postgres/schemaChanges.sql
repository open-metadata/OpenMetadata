-- Add generated columns for lastLoginTime and lastActivityTime to user_entity table for efficient querying of online users
ALTER TABLE user_entity 
ADD COLUMN lastLoginTime BIGINT GENERATED ALWAYS AS ((json->>'lastLoginTime')::bigint) STORED;

ALTER TABLE user_entity 
ADD COLUMN lastActivityTime BIGINT GENERATED ALWAYS AS ((json->>'lastActivityTime')::bigint) STORED;

-- Create index on lastLoginTime for fast queries
CREATE INDEX idx_user_entity_last_login_time ON user_entity(lastLoginTime);

-- Create index on lastActivityTime for fast queries
CREATE INDEX idx_user_entity_last_activity_time ON user_entity(lastActivityTime);

-- Create composite index for efficient online user queries with deleted flag
CREATE INDEX idx_user_entity_last_login_deleted ON user_entity(lastLoginTime, deleted);

-- Create composite index for efficient active user queries with deleted flag
CREATE INDEX idx_user_entity_last_activity_deleted ON user_entity(lastActivityTime, deleted);