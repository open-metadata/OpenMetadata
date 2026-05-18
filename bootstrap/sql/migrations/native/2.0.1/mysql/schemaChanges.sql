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

-- ContextMemory entity - reusable Context Center memory.
CREATE TABLE IF NOT EXISTS context_memory (
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
  name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') STORED NOT NULL,
  nameHash VARCHAR(256) NOT NULL COLLATE ascii_bin,
  json JSON NOT NULL,
  updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') STORED NOT NULL,
  updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') STORED NOT NULL,
  deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted') STORED,

  PRIMARY KEY (id),
  UNIQUE KEY unique_context_memory_name (nameHash),
  INDEX idx_context_memory_updated_at (updatedAt)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
