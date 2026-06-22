-- Task System Redesign - OpenMetadata 2.0.0
-- This migration creates the new Task entity tables and related infrastructure

CREATE TABLE IF NOT EXISTS task_entity (
    id varchar(36) NOT NULL,
    json json NOT NULL,
    fqnHash varchar(768) NOT NULL,
    taskId varchar(20) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.taskId'))) STORED NOT NULL,
    name varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) STORED NOT NULL,
    category varchar(32) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.category'))) STORED NOT NULL,
    type varchar(64) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.type'))) STORED NOT NULL,
    status varchar(32) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.status'))) STORED NOT NULL,
    priority varchar(16) GENERATED ALWAYS AS (COALESCE(json_unquote(json_extract(`json`,_utf8mb4'$.priority')), 'Medium')) STORED,
    createdAt bigint GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.createdAt'))) STORED NOT NULL,
    updatedAt bigint GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) STORED NOT NULL,
    deleted tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) STORED,
    aboutFqnHash varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.aboutFqnHash'))) STORED,
    createdById varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.createdById'))) STORED,
    approvedById varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.approvedById'))) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uk_fqn_hash (fqnHash),
    KEY idx_task_id (taskId),
    KEY idx_status (status),
    KEY idx_category (category),
    KEY idx_type (type),
    KEY idx_priority (priority),
    KEY idx_created_at (createdAt),
    KEY idx_updated_at (updatedAt),
    KEY idx_deleted (deleted),
    KEY idx_status_category (status, category),
    KEY idx_about_fqn_hash (aboutFqnHash),
    KEY idx_status_about (status, aboutFqnHash),
    KEY idx_created_by_id (createdById),
    KEY idx_created_by_category (createdById, category),
    KEY idx_approved_by_id (approvedById)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- For 2.0.0 environments that ran the CREATE TABLE above before the
-- approvedById generated column was added inline, attach it now. CREATE TABLE
-- IF NOT EXISTS is a no-op on those environments so the column would never
-- appear otherwise. MySQL doesn't reliably support `ADD COLUMN IF NOT EXISTS`
-- across 8.0 versions and has no `ADD KEY IF NOT EXISTS`, so guard both via
-- information_schema.
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

CREATE TABLE IF NOT EXISTS new_task_sequence (
    id bigint NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO new_task_sequence (id) SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM new_task_sequence);

-- =====================================================
-- ACTIVITY STREAM TABLE (Partitioned by time)
-- Lightweight, ephemeral activity notifications
-- NOT for audit/compliance - use entity version history
-- Partitions are managed dynamically by ActivityStreamPartitionManager
-- =====================================================
CREATE TABLE IF NOT EXISTS activity_stream (
    id varchar(36) NOT NULL,
    eventType varchar(64) NOT NULL,
    entityType varchar(64) NOT NULL,
    entityId varchar(36) NOT NULL,
    entityFqnHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin,
    about varchar(2048),
    aboutFqnHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin,
    -- Nullable for system events and hard-deleted users; actorName is the display fallback.
    actorId varchar(36),
    actorName varchar(256),
    timestamp bigint NOT NULL,
    summary varchar(500),
    fieldName varchar(256),
    oldValue text,
    newValue text,
    domains json,
    json json NOT NULL,
    PRIMARY KEY (id, timestamp),
    KEY idx_activity_timestamp (timestamp),
    KEY idx_activity_entity (entityType, entityId, timestamp),
    KEY idx_activity_actor (actorId, timestamp),
    KEY idx_activity_event_type (eventType, timestamp),
    KEY idx_activity_entity_fqn (entityFqnHash, timestamp),
    KEY idx_activity_about (aboutFqnHash, timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
PARTITION BY RANGE (timestamp) (
    -- Catch-all partition - ActivityStreamPartitionManager will reorganize this
    -- by splitting it into monthly partitions as needed
    PARTITION p_max VALUES LESS THAN MAXVALUE
);

-- Activity stream configuration per domain
CREATE TABLE IF NOT EXISTS activity_stream_config (
    id varchar(36) NOT NULL,
    json json NOT NULL,
    scope varchar(32) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.scope'))) STORED NOT NULL,
    domainId varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.scopeReference.id'))) STORED,
    enabled tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.enabled')) STORED,
    retentionDays int GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.retentionDays')) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uk_domain_config (domainId),
    KEY idx_scope (scope),
    KEY idx_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================
-- ANNOUNCEMENT ENTITY TABLE
-- Standalone entity for asset announcements (migrated from thread_entity)
-- =====================================================
CREATE TABLE IF NOT EXISTS announcement_entity (
    id varchar(36) NOT NULL,
    json json NOT NULL,
    fqnHash varchar(768) NOT NULL,
    name varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) STORED NOT NULL,
    entityLink varchar(512) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.entityLink'))) STORED,
    status varchar(32) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.status'))) STORED,
    startTime bigint GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.startTime'))) STORED,
    endTime bigint GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.endTime'))) STORED,
    createdBy varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.createdBy'))) STORED,
    createdAt bigint GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.createdAt'))) STORED,
    updatedAt bigint GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) STORED,
    deleted tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uk_announcement_fqn_hash (fqnHash),
    KEY idx_announcement_status (status),
    KEY idx_announcement_entity_link (entityLink),
    KEY idx_announcement_start_time (startTime),
    KEY idx_announcement_end_time (endTime),
    KEY idx_announcement_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================
-- TASK FORM SCHEMA ENTITY TABLE
-- Stores form schemas for different task types
-- =====================================================
CREATE TABLE IF NOT EXISTS task_form_schema_entity (
    id varchar(36) NOT NULL,
    json json NOT NULL,
    fqnHash varchar(768) NOT NULL,
    name varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) STORED NOT NULL,
    taskType varchar(64) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.taskType'))) STORED,
    taskCategory varchar(32) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.taskCategory'))) STORED,
    updatedAt bigint GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) STORED,
    deleted tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uk_task_form_schema_fqn_hash (fqnHash),
    KEY idx_task_form_schema_name (name),
    KEY idx_task_form_schema_task_type (taskType),
    KEY idx_task_form_schema_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =====================================================
-- KNOWLEDGE CENTER + CONTEXT CENTER DRIVE (Collate → OM port)
-- Appended below the Task Redesign tables to preserve main's
-- migration order when merging.
-- =====================================================

-- MCP tables are created in 1.13.0 migration.

-- Knowledge Center: page entity table (Article, QuickLink).
-- Existing Collate customers already have this table from 1.2.0-collate with
-- subsequent shape changes through 1.6.0-collate (nameHash -> fqnHash VARCHAR(756),
-- pageType generated column, composite deleted index). CREATE TABLE IF NOT EXISTS
-- is a no-op for them and creates the final shape for fresh OpenMetadata installs.
CREATE TABLE IF NOT EXISTS knowledge_center (
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
  fqnHash VARCHAR(756) NOT NULL COLLATE ascii_bin,
  name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') STORED NOT NULL,
  json JSON NOT NULL,
  updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') STORED NOT NULL,
  updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') STORED NOT NULL,
  deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted') STORED,
  pageType VARCHAR(16) GENERATED ALWAYS AS (json ->> '$.pageType') STORED NOT NULL,
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
  name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.fileName') STORED NOT NULL,
  url VARCHAR(1024) GENERATED ALWAYS AS (json ->> '$.url') STORED NOT NULL,
  fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.fullyQualifiedName') STORED NOT NULL,
  assetType VARCHAR(100) GENERATED ALWAYS AS (json ->> '$.assetType') STORED NOT NULL,
  json JSON NOT NULL,
  updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') STORED NOT NULL,
  updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') STORED NOT NULL,
  fqnHash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted') STORED,
  PRIMARY KEY (id),
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Database-backed user session store for multi-pod session management (issue #21971).
CREATE TABLE IF NOT EXISTS `user_session` (
  `id` varchar(64) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.id'))) STORED NOT NULL,
  `userId` varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.userId'))) STORED,
  `status` varchar(32) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.status'))) STORED NOT NULL,
  `expiresAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.expiresAt'))) STORED NOT NULL,
  `idleExpiresAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.idleExpiresAt'))) STORED NOT NULL,
  `updatedAt` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) STORED NOT NULL,
  `sessionType` varchar(32) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.type'))) VIRTUAL,
  `provider` varchar(64) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.provider'))) VIRTUAL,
  `version` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.version'))) VIRTUAL,
  `lastAccessedAt` bigint unsigned GENERATED ALWAYS AS (nullif(json_unquote(json_extract(`json`,_utf8mb4'$.lastAccessedAt')),'null')) VIRTUAL,
  `refreshLeaseUntil` bigint unsigned GENERATED ALWAYS AS (nullif(json_unquote(json_extract(`json`,_utf8mb4'$.refreshLeaseUntil')),'null')) VIRTUAL,
  `json` json NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_session_user_status` (`userId`,`status`),
  KEY `user_session_expiry` (`status`,`expiresAt`),
  KEY `user_session_idle_expiry` (`status`,`idleExpiresAt`),
  KEY `user_session_prune` (`status`,`updatedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Per-entity `name` indexes used by the distributed reindex's
-- `... ORDER BY name, id LIMIT 1 OFFSET :n` cursor query
-- (EntityRepository.getCursorAtOffset). These make cursor queries index-only
-- instead of a filesort that can exhaust sort memory (ER_OUT_OF_SORTMEMORY) on
-- large tables. Keep this in 2.0.0 because distributed reindex ships in 2.0.0.
CREATE INDEX directory_entity_name_index ON directory_entity (name);
CREATE INDEX drive_service_entity_name_index ON drive_service_entity (name);
CREATE INDEX file_entity_name_index ON file_entity (name);
CREATE INDEX spreadsheet_entity_name_index ON spreadsheet_entity (name);
CREATE INDEX worksheet_entity_name_index ON worksheet_entity (name);
CREATE INDEX task_entity_name_index ON task_entity (name);
CREATE INDEX announcement_entity_name_index ON announcement_entity (name);
CREATE INDEX drive_folder_name_index ON drive_folder (name);
CREATE INDEX asset_entity_name_index ON asset_entity (name);
-- learning_resource_entity is intentionally omitted: its `name` is varchar(3072),
-- which exceeds MySQL's 3072-byte index key limit (utf8mb4), and the table is small
-- enough that the reindex cursor sort is not a concern.

-- MCP conversation table for MCP Client message tracking
CREATE TABLE IF NOT EXISTS mcp_conversation (
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
  json JSON NOT NULL,
  userId VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.user.id') NOT NULL,
  createdAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.createdAt') NOT NULL,
  updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
  createdBy VARCHAR(50) GENERATED ALWAYS AS (json ->> '$.createdBy') NOT NULL,
  updatedBy VARCHAR(50) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
  messageCount INT GENERATED ALWAYS AS (json ->> '$.messageCount') STORED,

  PRIMARY KEY (id),
  INDEX idx_mcp_conversation_user_updated (userId, updatedAt DESC)
);

-- MCP message table for MCP Client message tracking
CREATE TABLE IF NOT EXISTS mcp_message (
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
  json JSON NOT NULL,
  conversationId VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.conversationId') STORED NOT NULL,
  sender VARCHAR(10) GENERATED ALWAYS AS (json ->> '$.sender') STORED NOT NULL,
  messageIndex INT GENERATED ALWAYS AS (json ->> '$.index') STORED,
  timestamp BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.timestamp') NOT NULL,

  PRIMARY KEY (id),
  CONSTRAINT fk_mcp_message_conversation FOREIGN KEY (conversationId) REFERENCES mcp_conversation(id) ON DELETE CASCADE,
  INDEX idx_mcp_message_conversation_index (conversationId, messageIndex),
  INDEX idx_mcp_message_conversation_created (conversationId, timestamp)
);
