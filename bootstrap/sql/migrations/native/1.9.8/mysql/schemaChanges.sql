-- Modify the path to the auto-generated operation column to extract from the JSON field
ALTER TABLE profiler_data_time_series
MODIFY COLUMN operation VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.profileData.operation') NULL;

-- Add unexecuted migrations for user_activity in version 1.8.1
-- Add generated columns for lastLoginTime and lastActivityTime

-- Add lastLoginTime column if not exists
SET @sql = (
   SELECT IF(
     EXISTS (
       SELECT 1
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE table_name = 'user_entity'
         AND column_name = 'lastLoginTime'
         AND table_schema = DATABASE()
     ),
     'SELECT "Column lastLoginTime already exists"',
     'ALTER TABLE user_entity ADD COLUMN lastLoginTime BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(\`json\`, ''$.lastLoginTime''))) VIRTUAL'
   )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt; SET @sql = NULL;

-- Add lastActivityTime column if not exists
SET @sql = (
   SELECT IF(
     EXISTS (
       SELECT 1
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE table_name = 'user_entity'
         AND column_name = 'lastActivityTime'
         AND table_schema = DATABASE()
     ),
     'SELECT "Column lastActivityTime already exists"',
     'ALTER TABLE user_entity ADD COLUMN lastActivityTime BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(\`json\`, ''$.lastActivityTime''))) VIRTUAL'
   )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt; SET @sql = NULL;

-- Add indexes only if they don't exist
-- MySQL doesn't support IF NOT EXISTS for CREATE INDEX, so we need to check first
SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE table_name = 'user_entity'
        AND index_name = 'idx_user_entity_last_login_time'
        AND table_schema = DATABASE()
    ),
    'SELECT "Index idx_user_entity_last_login_time already exists"',
    'CREATE INDEX idx_user_entity_last_login_time ON user_entity(lastLoginTime)'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt; SET @sql = NULL;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE table_name = 'user_entity'
        AND index_name = 'idx_user_entity_last_activity_time'
        AND table_schema = DATABASE()
    ),
    'SELECT "Index idx_user_entity_last_activity_time already exists"',
    'CREATE INDEX idx_user_entity_last_activity_time ON user_entity(lastActivityTime)'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt; SET @sql = NULL;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE table_name = 'user_entity'
        AND index_name = 'idx_user_entity_last_login_deleted'
        AND table_schema = DATABASE()
    ),
    'SELECT "Index idx_user_entity_last_login_deleted already exists"',
    'CREATE INDEX idx_user_entity_last_login_deleted ON user_entity(lastLoginTime, deleted)'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt; SET @sql = NULL;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE table_name = 'user_entity'
        AND index_name = 'idx_user_entity_last_activity_deleted'
        AND table_schema = DATABASE()
    ),
    'SELECT "Index idx_user_entity_last_activity_deleted already exists"',
    'CREATE INDEX idx_user_entity_last_activity_deleted ON user_entity(lastActivityTime, deleted)'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt; SET @sql = NULL;