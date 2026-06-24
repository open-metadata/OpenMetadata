-- Task System Redesign - OpenMetadata 2.0.0
-- This migration creates the new Task entity tables and related infrastructure

CREATE TABLE IF NOT EXISTS task_entity (
    id character varying(36) NOT NULL,
    json jsonb NOT NULL,
    fqnhash character varying(768) NOT NULL,
    taskid character varying(20) GENERATED ALWAYS AS ((json ->> 'taskId'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    category character varying(32) GENERATED ALWAYS AS ((json ->> 'category'::text)) STORED NOT NULL,
    type character varying(64) GENERATED ALWAYS AS ((json ->> 'type'::text)) STORED NOT NULL,
    status character varying(32) GENERATED ALWAYS AS ((json ->> 'status'::text)) STORED NOT NULL,
    priority character varying(16) GENERATED ALWAYS AS (COALESCE((json ->> 'priority'::text), 'Medium'::text)) STORED,
    createdat bigint GENERATED ALWAYS AS (((json ->> 'createdAt'::text))::bigint) STORED NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    aboutfqnhash character varying(256) GENERATED ALWAYS AS ((json ->> 'aboutFqnHash'::text)) STORED,
    createdbyid character varying(36) GENERATED ALWAYS AS ((json ->> 'createdById'::text)) STORED,
    approvedbyid character varying(36) GENERATED ALWAYS AS ((json ->> 'approvedById'::text)) STORED,
    PRIMARY KEY (id),
    CONSTRAINT uk_task_fqn_hash UNIQUE (fqnhash)
);

CREATE INDEX IF NOT EXISTS idx_task_taskid ON task_entity (taskid);
CREATE INDEX IF NOT EXISTS idx_task_status ON task_entity (status);
CREATE INDEX IF NOT EXISTS idx_task_category ON task_entity (category);
CREATE INDEX IF NOT EXISTS idx_task_type ON task_entity (type);
CREATE INDEX IF NOT EXISTS idx_task_priority ON task_entity (priority);
CREATE INDEX IF NOT EXISTS idx_task_createdat ON task_entity (createdat);
CREATE INDEX IF NOT EXISTS idx_task_updatedat ON task_entity (updatedat);
CREATE INDEX IF NOT EXISTS idx_task_deleted ON task_entity (deleted);
CREATE INDEX IF NOT EXISTS idx_task_status_category ON task_entity (status, category);
CREATE INDEX IF NOT EXISTS idx_task_about_fqn_hash ON task_entity (aboutfqnhash);
CREATE INDEX IF NOT EXISTS idx_task_status_about ON task_entity (status, aboutfqnhash);
CREATE INDEX IF NOT EXISTS idx_task_created_by_id ON task_entity (createdbyid);
CREATE INDEX IF NOT EXISTS idx_task_created_by_category ON task_entity (createdbyid, category);

-- For 2.0.0 environments that ran the CREATE TABLE above before the
-- approvedbyid generated column was added inline, attach it now. CREATE TABLE
-- IF NOT EXISTS is a no-op on those environments so the column would never
-- appear otherwise. Postgres supports `ADD COLUMN IF NOT EXISTS` natively.
-- The ALTER must run before idx_task_approved_by_id is created — otherwise
-- existing-2.0.0 deployments would fail the CREATE INDEX with "column does
-- not exist" before the ADD COLUMN ever runs.
ALTER TABLE task_entity
    ADD COLUMN IF NOT EXISTS approvedbyid character varying(36)
        GENERATED ALWAYS AS ((json ->> 'approvedById'::text)) STORED;

CREATE INDEX IF NOT EXISTS idx_task_approved_by_id ON task_entity (approvedbyid);

CREATE TABLE IF NOT EXISTS new_task_sequence (
    id bigint NOT NULL DEFAULT 0
);

INSERT INTO new_task_sequence (id) SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM new_task_sequence);

-- =====================================================
-- ACTIVITY STREAM TABLE (Partitioned by time)
-- Lightweight, ephemeral activity notifications
-- NOT for audit/compliance - use entity version history
-- Partitions are managed dynamically by ActivityStreamPartitionManager
-- =====================================================
CREATE TABLE IF NOT EXISTS activity_stream (
    id character varying(36) NOT NULL,
    eventtype character varying(64) NOT NULL,
    entitytype character varying(64) NOT NULL,
    entityid character varying(36) NOT NULL,
    entityfqnhash character varying(768),
    about character varying(2048),
    aboutfqnhash character varying(768),
    -- Nullable for system events and hard-deleted users; actorname is the display fallback.
    actorid character varying(36),
    actorname character varying(256),
    timestamp bigint NOT NULL,
    summary character varying(500),
    fieldname character varying(256),
    oldvalue text,
    newvalue text,
    domains jsonb,
    json jsonb NOT NULL,
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Default partition catches all data until monthly partitions are created
-- ActivityStreamPartitionManager will create monthly partitions and detach old ones
CREATE TABLE IF NOT EXISTS activity_stream_default PARTITION OF activity_stream DEFAULT;

-- Indexes for activity stream (created on parent, inherited by partitions)
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_stream (timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_stream (entitytype, entityid, timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_actor ON activity_stream (actorid, timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_event_type ON activity_stream (eventtype, timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_entity_fqn ON activity_stream (entityfqnhash, timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_about ON activity_stream (aboutfqnhash, timestamp);

-- Activity stream configuration per domain
CREATE TABLE IF NOT EXISTS activity_stream_config (
    id character varying(36) NOT NULL,
    json jsonb NOT NULL,
    scope character varying(32) GENERATED ALWAYS AS ((json ->> 'scope'::text)) STORED NOT NULL,
    domainid character varying(36) GENERATED ALWAYS AS ((json -> 'scopeReference' ->> 'id'::text)) STORED,
    enabled boolean GENERATED ALWAYS AS (((json ->> 'enabled'::text))::boolean) STORED,
    retentiondays integer GENERATED ALWAYS AS (((json ->> 'retentionDays'::text))::integer) STORED,
    PRIMARY KEY (id),
    CONSTRAINT uk_activity_domain_config UNIQUE (domainid)
);

CREATE INDEX IF NOT EXISTS idx_activity_config_scope ON activity_stream_config (scope);
CREATE INDEX IF NOT EXISTS idx_activity_config_enabled ON activity_stream_config (enabled);

-- =====================================================
-- ANNOUNCEMENT ENTITY TABLE
-- Standalone entity for asset announcements (migrated from thread_entity)
-- =====================================================
CREATE TABLE IF NOT EXISTS announcement_entity (
    id character varying(36) NOT NULL,
    json jsonb NOT NULL,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    entitylink character varying(512) GENERATED ALWAYS AS ((json ->> 'entityLink'::text)) STORED,
    status character varying(32) GENERATED ALWAYS AS ((json ->> 'status'::text)) STORED,
    starttime bigint GENERATED ALWAYS AS (((json ->> 'startTime'::text))::bigint) STORED,
    endtime bigint GENERATED ALWAYS AS (((json ->> 'endTime'::text))::bigint) STORED,
    createdby character varying(256) GENERATED ALWAYS AS ((json ->> 'createdBy'::text)) STORED,
    createdat bigint GENERATED ALWAYS AS (((json ->> 'createdAt'::text))::bigint) STORED,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    PRIMARY KEY (id),
    CONSTRAINT uk_announcement_fqn_hash UNIQUE (fqnhash)
);

CREATE INDEX IF NOT EXISTS idx_announcement_status ON announcement_entity (status);
CREATE INDEX IF NOT EXISTS idx_announcement_entitylink ON announcement_entity (entitylink);
CREATE INDEX IF NOT EXISTS idx_announcement_starttime ON announcement_entity (starttime);
CREATE INDEX IF NOT EXISTS idx_announcement_endtime ON announcement_entity (endtime);
CREATE INDEX IF NOT EXISTS idx_announcement_deleted ON announcement_entity (deleted);

-- =====================================================
-- TASK FORM SCHEMA ENTITY TABLE
-- Stores form schemas for different task types
-- =====================================================
CREATE TABLE IF NOT EXISTS task_form_schema_entity (
    id character varying(36) NOT NULL,
    json jsonb NOT NULL,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    tasktype character varying(64) GENERATED ALWAYS AS ((json ->> 'taskType'::text)) STORED,
    taskcategory character varying(32) GENERATED ALWAYS AS ((json ->> 'taskCategory'::text)) STORED,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    PRIMARY KEY (id),
    CONSTRAINT uk_task_form_schema_fqn_hash UNIQUE (fqnhash)
);

CREATE INDEX IF NOT EXISTS idx_task_form_schema_name ON task_form_schema_entity (name);
CREATE INDEX IF NOT EXISTS idx_task_form_schema_tasktype ON task_form_schema_entity (tasktype);
CREATE INDEX IF NOT EXISTS idx_task_form_schema_deleted ON task_form_schema_entity (deleted);

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
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
  fqnHash VARCHAR(756) NOT NULL,
  name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
  json JSONB NOT NULL,
  updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
  updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
  deleted BOOLEAN GENERATED ALWAYS AS (COALESCE((json ->> 'deleted')::boolean, false)) STORED,
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
  deleted BOOLEAN GENERATED ALWAYS AS (COALESCE((json ->> 'deleted')::boolean, false)) STORED,
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
  deleted BOOLEAN GENERATED ALWAYS AS (COALESCE((json ->> 'deleted')::boolean, false)) STORED,
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
  deleted BOOLEAN GENERATED ALWAYS AS (COALESCE(CAST(json ->> 'deleted' AS BOOLEAN), false)) STORED,
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
  deleted BOOLEAN GENERATED ALWAYS AS (COALESCE((json ->> 'deleted')::boolean, false)) STORED,
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

-- Database-backed user session store for multi-pod session management (issue #21971).
CREATE TABLE IF NOT EXISTS user_session (
    id character varying(64) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    userid character varying(36) GENERATED ALWAYS AS ((json ->> 'userId'::text)) STORED,
    status character varying(32) GENERATED ALWAYS AS ((json ->> 'status'::text)) STORED NOT NULL,
    expiresat bigint GENERATED ALWAYS AS (((json ->> 'expiresAt'::text))::bigint) STORED NOT NULL,
    idleexpiresat bigint GENERATED ALWAYS AS (((json ->> 'idleExpiresAt'::text))::bigint) STORED NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    sessiontype character varying(32) GENERATED ALWAYS AS ((json ->> 'type'::text)) STORED,
    provider character varying(64) GENERATED ALWAYS AS ((json ->> 'provider'::text)) STORED,
    version bigint GENERATED ALWAYS AS (((json ->> 'version'::text))::bigint) STORED,
    lastaccessedat bigint GENERATED ALWAYS AS (((json ->> 'lastAccessedAt'::text))::bigint) STORED,
    refreshleaseuntil bigint GENERATED ALWAYS AS (((json ->> 'refreshLeaseUntil'::text))::bigint) STORED,
    json jsonb NOT NULL,
    CONSTRAINT user_session_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS user_session_user_status_idx ON user_session USING btree (userid, status);
CREATE INDEX IF NOT EXISTS user_session_expiry_idx ON user_session USING btree (status, expiresat);
CREATE INDEX IF NOT EXISTS user_session_idle_expiry_idx ON user_session USING btree (status, idleexpiresat);
CREATE INDEX IF NOT EXISTS user_session_prune_idx ON user_session USING btree (status, updatedat);

-- Per-entity `name` index for entity tables first created in 2.0.0, so the distributed
-- reindex's `... ORDER BY name, id LIMIT 1 OFFSET :n` cursor query
-- (EntityRepository.getCursorAtOffset) runs index-only instead of a sort that can exhaust
-- work_mem on large tables. Added here (not 1.13.1) because these tables are created above
-- in this same 2.0.0 migration. Idempotent via IF NOT EXISTS.
CREATE INDEX IF NOT EXISTS task_entity_name_index ON task_entity (name);
CREATE INDEX IF NOT EXISTS announcement_entity_name_index ON announcement_entity (name);
CREATE INDEX IF NOT EXISTS drive_folder_name_index ON drive_folder (name);
CREATE INDEX IF NOT EXISTS asset_entity_name_index ON asset_entity (name);
-- context_file / context_memory are also created above in this migration and are reindexed;
-- they only had a `nameHash` unique key, so add the leading-`name` index the cursor query needs.
CREATE INDEX IF NOT EXISTS context_file_name_index ON context_file (name);
CREATE INDEX IF NOT EXISTS context_memory_name_index ON context_memory (name);

-- MCP conversation table for MCP Client message tracking
CREATE TABLE IF NOT EXISTS mcp_conversation (
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
  json JSONB NOT NULL,
  userId VARCHAR(256) GENERATED ALWAYS AS ((json -> 'user') ->> 'id') STORED NOT NULL,
  createdAt BIGINT GENERATED ALWAYS AS ((json ->> 'createdAt')::bigint) STORED NOT NULL,
  updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
  createdBy VARCHAR(50) GENERATED ALWAYS AS (json ->> 'createdBy') STORED NOT NULL,
  updatedBy VARCHAR(50) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
  messageCount INT GENERATED ALWAYS AS ((json ->> 'messageCount')::int) STORED,

  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_mcp_conversation_user_updated ON mcp_conversation (userId, updatedAt DESC);

-- MCP message table for MCP Client message tracking
CREATE TABLE IF NOT EXISTS mcp_message (
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
  json JSONB NOT NULL,
  conversationId VARCHAR(36) GENERATED ALWAYS AS (json ->> 'conversationId') STORED NOT NULL,
  sender VARCHAR(10) GENERATED ALWAYS AS (json ->> 'sender') STORED NOT NULL,
  messageIndex INT GENERATED ALWAYS AS ((json ->> 'index')::int) STORED,
  timestamp BIGINT GENERATED ALWAYS AS ((json ->> 'timestamp')::bigint) STORED NOT NULL,

  PRIMARY KEY (id),
  CONSTRAINT fk_mcp_message_conversation FOREIGN KEY (conversationId) REFERENCES mcp_conversation(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mcp_message_conversation_index ON mcp_message (conversationId, messageIndex);
CREATE INDEX IF NOT EXISTS idx_mcp_message_conversation_created ON mcp_message (conversationId, timestamp);
