-- MCP tables are created in 1.13.0 migration.

-- Knowledge Center: page entity table (Article, QuickLink).
-- Existing Collate customers already have this table from 1.2.0-collate with
-- subsequent shape changes through 1.6.0-collate (nameHash -> fqnHash VARCHAR(756),
-- pageType generated column, composite deleted index). CREATE TABLE IF NOT EXISTS
-- is a no-op for them and creates the final shape for fresh OpenMetadata installs.
CREATE TABLE IF NOT EXISTS knowledge_center (
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
  fqnHash VARCHAR(756) NOT NULL,
  name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
  json JSONB NOT NULL,
  updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
  updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
  deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
  pageType VARCHAR(16) GENERATED ALWAYS AS (json ->> 'pageType') STORED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (fqnHash)
);
CREATE INDEX IF NOT EXISTS knowledge_center_name_index ON knowledge_center (name);
CREATE INDEX IF NOT EXISTS index_knowledge_center_deleted ON knowledge_center (fqnHash, deleted);

-- Context Center Drive: Folder entity table.
CREATE TABLE IF NOT EXISTS drive_folder (
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
CREATE INDEX IF NOT EXISTS idx_drive_folder_updated_at ON drive_folder (updatedAt);

-- Context Center Drive: File entity table (uploaded PDF/image/spreadsheet/office docs).
CREATE TABLE IF NOT EXISTS context_file (
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
CREATE INDEX IF NOT EXISTS idx_context_file_updated_at ON context_file (updatedAt);

-- Attachments: Asset entity table for uploaded file blobs referenced by ContextFiles, Pages, etc.
-- Existing Collate customers have this from 1.7.0-collate. CREATE TABLE IF NOT EXISTS is a no-op for them.
CREATE TABLE IF NOT EXISTS asset_entity (
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
  name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'fileName') STORED NOT NULL,
  url VARCHAR(1024) GENERATED ALWAYS AS (json ->> 'url') STORED NOT NULL,
  fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED NOT NULL,
  assetType VARCHAR(100) GENERATED ALWAYS AS (json ->> 'assetType') STORED NOT NULL,
  json JSONB NOT NULL,
  updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
  updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
  fqnHash VARCHAR(768) NOT NULL,
  deleted BOOLEAN GENERATED ALWAYS AS (CAST(json ->> 'deleted' AS BOOLEAN)) STORED,
  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS fqnhash_index ON asset_entity (fqnHash);
CREATE INDEX IF NOT EXISTS asset_type_index ON asset_entity (assetType);
CREATE INDEX IF NOT EXISTS idx_asset_deleted ON asset_entity (deleted);

-- Context Center Drive: File content snapshot table (revisions, extracted text).
CREATE TABLE IF NOT EXISTS context_file_content (
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
CREATE INDEX IF NOT EXISTS idx_context_file_content_updated_at ON context_file_content (updatedAt);

-- Add tag_usage.metadata column if missing (newer tag usage payloads carry metadata).
ALTER TABLE IF EXISTS tag_usage
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add audit_log_event.search_text column if missing (searchable audit log text).
ALTER TABLE IF EXISTS audit_log_event
  ADD COLUMN IF NOT EXISTS search_text TEXT;

-- Distributed reindex job tracking.
CREATE TABLE IF NOT EXISTS search_index_job (
  id VARCHAR(64) PRIMARY KEY,
  status VARCHAR(64) NOT NULL,
  jobConfiguration JSONB NOT NULL,
  targetIndexPrefix VARCHAR(256) NOT NULL,
  stagedIndexMapping JSONB NULL,
  totalRecords BIGINT NOT NULL DEFAULT 0,
  processedRecords BIGINT NOT NULL DEFAULT 0,
  successRecords BIGINT NOT NULL DEFAULT 0,
  failedRecords BIGINT NOT NULL DEFAULT 0,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  createdBy VARCHAR(256) NOT NULL,
  createdAt BIGINT NOT NULL,
  startedAt BIGINT NULL,
  completedAt BIGINT NULL,
  updatedAt BIGINT NOT NULL,
  errorMessage TEXT NULL,
  registrationDeadline BIGINT NULL,
  registeredServerCount INTEGER NULL
);
CREATE INDEX IF NOT EXISTS idx_search_index_job_status_created_at
  ON search_index_job (status, createdAt DESC);

-- Retry queue for failed search-index writes.
CREATE TABLE IF NOT EXISTS search_index_retry_queue (
  entityId VARCHAR(64) NOT NULL,
  entityFqn VARCHAR(768) NOT NULL,
  failureReason TEXT NULL,
  status VARCHAR(64) NOT NULL,
  entityType VARCHAR(128) NOT NULL,
  retryCount INTEGER NOT NULL DEFAULT 0,
  claimedAt TIMESTAMP NULL,
  PRIMARY KEY (entityId, entityFqn)
);
CREATE INDEX IF NOT EXISTS idx_search_index_retry_queue_status
  ON search_index_retry_queue (status);
CREATE INDEX IF NOT EXISTS idx_search_index_retry_queue_claimed_at
  ON search_index_retry_queue (claimedAt);
