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
