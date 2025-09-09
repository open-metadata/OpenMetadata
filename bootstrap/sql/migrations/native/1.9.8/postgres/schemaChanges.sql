-- Modify the path to the auto-generated operation column to extract from the JSON field
-- 1. Drop the unique constraint first
ALTER TABLE profiler_data_time_series
DROP CONSTRAINT IF EXISTS profiler_data_time_series_unique_hash_extension_ts;
-- 2. Drop the generated column
ALTER TABLE profiler_data_time_series
DROP COLUMN operation;
-- 3. Add the column back with new expression
ALTER TABLE profiler_data_time_series
ADD COLUMN operation VARCHAR(256) GENERATED ALWAYS AS (json -> 'profileData' ->> 'operation') STORED;

-- Add unexecuted migrations for user_activity in version 1.8.1
-- Add generated columns (no-op if they already exist)
ALTER TABLE user_entity
  ADD COLUMN IF NOT EXISTS lastLoginTime BIGINT
  GENERATED ALWAYS AS ((json->>'lastLoginTime')::bigint) STORED;

ALTER TABLE user_entity
  ADD COLUMN IF NOT EXISTS lastActivityTime BIGINT
  GENERATED ALWAYS AS ((json->>'lastActivityTime')::bigint) STORED;


CREATE INDEX IF NOT EXISTS idx_user_entity_last_login_time ON user_entity (lastLoginTime);
CREATE INDEX IF NOT EXISTS idx_user_entity_last_activity_time ON user_entity (lastActivityTime);
CREATE INDEX IF NOT EXISTS idx_user_entity_last_login_deleted ON user_entity (lastLoginTime, deleted);
CREATE INDEX IF NOT EXISTS idx_user_entity_last_activity_deleted ON user_entity (lastActivityTime, deleted);
