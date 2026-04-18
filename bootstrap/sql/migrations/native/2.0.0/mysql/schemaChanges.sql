-- MCP tables are created in 1.13.0 migration.

-- Knowledge Center: page entity table (Article, QuickLink).
-- Existing Collate customers already have this table from 1.2.0-collate with
-- subsequent shape changes through 1.6.0-collate (nameHash -> fqnHash VARCHAR(756),
-- pageType generated column, composite deleted index). CREATE TABLE IF NOT EXISTS
-- is a no-op for them and creates the final shape for fresh OpenMetadata installs.
CREATE TABLE IF NOT EXISTS knowledge_center (
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
  fqnHash VARCHAR(756) NOT NULL COLLATE ascii_bin,
  name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
  json JSON NOT NULL,
  updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
  updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
  deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted'),
  pageType VARCHAR(16) GENERATED ALWAYS AS (json ->> '$.pageType') NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (fqnHash),
  INDEX knowledge_center_name_index (name),
  INDEX index_knowledge_center_deleted (fqnHash, deleted)
);

-- Context Center Drive: Folder entity table.
CREATE TABLE IF NOT EXISTS drive_folder (
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
  name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') STORED NOT NULL,
  nameHash VARCHAR(256) NOT NULL COLLATE ascii_bin,
  json JSON NOT NULL,
  updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') STORED NOT NULL,
  updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') STORED NOT NULL,
  deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted') STORED,
  PRIMARY KEY (id),
  UNIQUE KEY unique_drive_folder_name (nameHash),
  INDEX idx_drive_folder_updated_at (updatedAt)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Context Center Drive: File entity table (uploaded PDF/image/spreadsheet/office docs).
CREATE TABLE IF NOT EXISTS context_file (
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
  name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') STORED NOT NULL,
  nameHash VARCHAR(256) NOT NULL COLLATE ascii_bin,
  json JSON NOT NULL,
  updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') STORED NOT NULL,
  updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') STORED NOT NULL,
  deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted') STORED,
  PRIMARY KEY (id),
  UNIQUE KEY unique_context_file_name (nameHash),
  INDEX idx_context_file_updated_at (updatedAt)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Attachments: Asset entity table for uploaded file blobs referenced by ContextFiles, Pages, etc.
-- Existing Collate customers have this from 1.7.0-collate. CREATE TABLE IF NOT EXISTS is a no-op for them.
CREATE TABLE IF NOT EXISTS asset_entity (
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
  name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.fileName') NOT NULL,
  url VARCHAR(1024) GENERATED ALWAYS AS (json ->> '$.url') STORED NOT NULL,
  fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.fullyQualifiedName') NOT NULL,
  assetType VARCHAR(100) GENERATED ALWAYS AS (json ->> '$.assetType') NOT NULL,
  json JSON NOT NULL,
  updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
  updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
  fqnHash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted'),
  INDEX fqnhash_index (fqnHash),
  INDEX asset_type_index (assetType),
  INDEX idx_asset_deleted (deleted)
);

-- Context Center Drive: File content snapshot table (revisions, extracted text).
CREATE TABLE IF NOT EXISTS context_file_content (
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
  name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') STORED NOT NULL,
  nameHash VARCHAR(256) NOT NULL COLLATE ascii_bin,
  json JSON NOT NULL,
  updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') STORED NOT NULL,
  updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') STORED NOT NULL,
  deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted') STORED,
  PRIMARY KEY (id),
  UNIQUE KEY unique_context_file_content_name (nameHash),
  INDEX idx_context_file_content_updated_at (updatedAt)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Add tag_usage.metadata column if missing (newer tag usage payloads carry metadata).
SET @ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'tag_usage'
        AND column_name = 'metadata'
    ),
    'SELECT 1',
    'ALTER TABLE tag_usage ADD COLUMN metadata JSON NULL'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add audit_log_event.search_text column if missing (searchable audit log text).
SET @ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'audit_log_event'
        AND column_name = 'search_text'
    ),
    'SELECT 1',
    'ALTER TABLE audit_log_event ADD COLUMN search_text LONGTEXT NULL'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Distributed reindex job tracking.
CREATE TABLE IF NOT EXISTS search_index_job (
  id VARCHAR(64) NOT NULL,
  status VARCHAR(64) NOT NULL,
  jobConfiguration JSON NOT NULL,
  targetIndexPrefix VARCHAR(256) NOT NULL,
  stagedIndexMapping JSON DEFAULT NULL,
  totalRecords BIGINT NOT NULL DEFAULT 0,
  processedRecords BIGINT NOT NULL DEFAULT 0,
  successRecords BIGINT NOT NULL DEFAULT 0,
  failedRecords BIGINT NOT NULL DEFAULT 0,
  stats JSON NOT NULL,
  createdBy VARCHAR(256) NOT NULL,
  createdAt BIGINT NOT NULL,
  startedAt BIGINT DEFAULT NULL,
  completedAt BIGINT DEFAULT NULL,
  updatedAt BIGINT NOT NULL,
  errorMessage LONGTEXT DEFAULT NULL,
  registrationDeadline BIGINT DEFAULT NULL,
  registeredServerCount INT DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_search_index_job_status_created_at (status, createdAt DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Retry queue for failed search-index writes.
CREATE TABLE IF NOT EXISTS search_index_retry_queue (
  entityId VARCHAR(64) NOT NULL,
  entityFqn VARCHAR(700) NOT NULL,
  failureReason LONGTEXT DEFAULT NULL,
  status VARCHAR(64) NOT NULL,
  entityType VARCHAR(128) NOT NULL,
  retryCount INT NOT NULL DEFAULT 0,
  claimedAt TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (entityId, entityFqn),
  KEY idx_search_index_retry_queue_status (status),
  KEY idx_search_index_retry_queue_claimed_at (claimedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
