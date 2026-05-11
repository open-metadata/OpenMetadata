-- Task workflow cutover support - OpenMetadata 2.0.1
-- Maps legacy thread task IDs to new task entity IDs for migration traceability and redirects.

CREATE TABLE IF NOT EXISTS task_migration_mapping (
    old_thread_id varchar(36) NOT NULL,
    new_task_id varchar(36) NOT NULL,
    migrated_at bigint NOT NULL,
    source varchar(64) DEFAULT 'thread_task_migration',
    PRIMARY KEY (old_thread_id),
    KEY idx_task_migration_mapping_new_task_id (new_task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data Access Request: indexed approver column for the Approver filter on
-- /v1/tasks and /v1/tasks/dataAccessRequests. MySQL doesn't support
-- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` reliably across 8.0 versions and
-- has no `ADD KEY IF NOT EXISTS`, so guard both adds via information_schema.
SET @ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'task_entity'
        AND column_name = 'approvedById'
    ),
    'SELECT 1',
    'ALTER TABLE task_entity ADD COLUMN approvedById varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4''$.approvedById''))) STORED'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'task_entity'
        AND index_name = 'idx_approved_by_id'
    ),
    'SELECT 1',
    'ALTER TABLE task_entity ADD KEY idx_approved_by_id (approvedById)'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
