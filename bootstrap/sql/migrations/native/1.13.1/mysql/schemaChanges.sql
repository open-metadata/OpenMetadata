SET @ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'background_jobs'
        AND column_name = 'progress'
    ),
    'SELECT 1',
    'ALTER TABLE background_jobs ADD COLUMN progress int DEFAULT 0'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'background_jobs'
        AND column_name = 'total'
    ),
    'SELECT 1',
    'ALTER TABLE background_jobs ADD COLUMN total int DEFAULT 0'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'background_jobs'
        AND column_name = 'result'
    ),
    'SELECT 1',
    'ALTER TABLE background_jobs ADD COLUMN result longtext'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'background_jobs'
        AND column_name = 'error'
    ),
    'SELECT 1',
    'ALTER TABLE background_jobs ADD COLUMN error longtext'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'background_jobs'
        AND column_name = 'message'
    ),
    'SELECT 1',
    'ALTER TABLE background_jobs ADD COLUMN message varchar(2048)'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'background_jobs'
        AND column_name = 'cancelRequested'
    ),
    'SELECT 1',
    'ALTER TABLE background_jobs ADD COLUMN cancelRequested boolean DEFAULT false'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'background_jobs'
        AND column_name = 'completedAt'
    ),
    'SELECT 1',
    'ALTER TABLE background_jobs ADD COLUMN completedAt bigint'
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
        AND table_name = 'background_jobs'
        AND index_name = 'idx_background_jobs_job_type_created_by'
    ),
    'SELECT 1',
    'CREATE INDEX idx_background_jobs_job_type_created_by ON background_jobs (jobType, createdBy, createdAt)'
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
        AND table_name = 'background_jobs'
        AND index_name = 'idx_background_jobs_status_updated_at'
    ),
    'SELECT 1',
    'CREATE INDEX idx_background_jobs_status_updated_at ON background_jobs (status, updatedAt)'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS background_job_logs (
  logId varchar(36) NOT NULL,
  jobId bigint unsigned NOT NULL,
  createdAt bigint NOT NULL,
  level varchar(16) NOT NULL,
  message varchar(4096) NOT NULL,
  PRIMARY KEY (logId),
  KEY idx_background_job_logs_job_id_created_at (jobId, createdAt),
  CONSTRAINT fk_background_job_logs_job_id
    FOREIGN KEY (jobId) REFERENCES background_jobs(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- IntakeForm entity table: per-entity-type governance-required-field configuration
CREATE TABLE IF NOT EXISTS intake_form_entity (
  id varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,'$.id'))) STORED NOT NULL,
  name varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,'$.name'))) VIRTUAL NOT NULL,
  fqnHash varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  entityType varchar(64) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,'$.entityType'))) VIRTUAL NOT NULL,
  json json NOT NULL,
  updatedAt bigint UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(`json`,'$.updatedAt'))) VIRTUAL NOT NULL,
  updatedBy varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,'$.updatedBy'))) VIRTUAL NOT NULL,
  deleted TINYINT(1) GENERATED ALWAYS AS (IF(json_extract(json,'$.deleted') = TRUE, 1, 0)) VIRTUAL,
  PRIMARY KEY (id),
  UNIQUE KEY fqnHash (fqnHash),
  UNIQUE KEY intake_form_entity_type_unique (entityType)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Backfill the per-entity `name` index on entity tables that were created without
-- one. The distributed reindex paginates every entity type with
-- `... ORDER BY name, id LIMIT 1 OFFSET :n` (EntityRepository.getCursorAtOffset);
-- without a leading-`name` index that ORDER BY is a filesort that can exhaust sort
-- memory (ER_OUT_OF_SORTMEMORY, "Out of sort memory, consider increasing server sort
-- buffer size") on large tables. `<table>_name_index(name)` (InnoDB appends the PK
-- `id`) lets the cursor query run index-only instead. Covers entity tables that exist
-- as of 1.13.1; tables introduced later get the index in their own migration.
SET @ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'directory_entity'
        AND index_name = 'directory_entity_name_index'
    ),
    'SELECT 1',
    'CREATE INDEX directory_entity_name_index ON directory_entity (name)'
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
        AND table_name = 'drive_service_entity'
        AND index_name = 'drive_service_entity_name_index'
    ),
    'SELECT 1',
    'CREATE INDEX drive_service_entity_name_index ON drive_service_entity (name)'
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
        AND table_name = 'file_entity'
        AND index_name = 'file_entity_name_index'
    ),
    'SELECT 1',
    'CREATE INDEX file_entity_name_index ON file_entity (name)'
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
        AND table_name = 'spreadsheet_entity'
        AND index_name = 'spreadsheet_entity_name_index'
    ),
    'SELECT 1',
    'CREATE INDEX spreadsheet_entity_name_index ON spreadsheet_entity (name)'
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
        AND table_name = 'worksheet_entity'
        AND index_name = 'worksheet_entity_name_index'
    ),
    'SELECT 1',
    'CREATE INDEX worksheet_entity_name_index ON worksheet_entity (name)'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
-- learning_resource_entity is intentionally omitted: its `name` is varchar(3072),
-- which exceeds MySQL's 3072-byte index key limit (utf8mb4), and the table is small
-- enough that the reindex cursor sort is not a concern.
