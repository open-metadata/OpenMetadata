-- Task workflow cutover support - OpenMetadata 2.0.1
-- Maps legacy thread task IDs to new task entity IDs for migration traceability and redirects.

CREATE TABLE IF NOT EXISTS task_migration_mapping (
    old_thread_id character varying(36) NOT NULL,
    new_task_id character varying(36) NOT NULL,
    migrated_at bigint NOT NULL,
    source character varying(64) DEFAULT 'thread_task_migration',
    PRIMARY KEY (old_thread_id)
);

CREATE INDEX IF NOT EXISTS idx_task_migration_mapping_new_task_id
    ON task_migration_mapping (new_task_id);

-- ContextMemory entity - reusable Context Center memory.
CREATE TABLE IF NOT EXISTS context_memory (
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
  name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
  nameHash VARCHAR(256) NOT NULL,
  json JSONB NOT NULL,
  updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
  updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
  deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,

  PRIMARY KEY (id),
  UNIQUE (nameHash)
);
CREATE INDEX IF NOT EXISTS idx_context_memory_updated_at ON context_memory (updatedAt);
