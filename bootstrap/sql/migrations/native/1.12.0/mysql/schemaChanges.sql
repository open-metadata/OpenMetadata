-- Update ApplicationBotRole to include Trigger operation
UPDATE policy_entity
SET json = JSON_ARRAY_APPEND(json, '$.rules[0].operations', 'Trigger')
WHERE name = 'ApplicationBotPolicy'
  AND JSON_EXTRACT(json, '$.rules[0].operations') IS NOT NULL
  AND NOT JSON_CONTAINS(JSON_EXTRACT(json, '$.rules[0].operations'), '"Trigger"');

-- Create table for persisted audit log events
CREATE TABLE IF NOT EXISTS audit_log_event (
  id BIGINT NOT NULL AUTO_INCREMENT,
  change_event_id CHAR(36) NOT NULL,
  event_ts BIGINT NOT NULL,
  event_type VARCHAR(32) NOT NULL,
  user_name VARCHAR(256) DEFAULT NULL,
  actor_type VARCHAR(32) DEFAULT 'USER',
  impersonated_by VARCHAR(256) DEFAULT NULL,
  service_name VARCHAR(256) DEFAULT NULL,
  entity_type VARCHAR(128) DEFAULT NULL,
  entity_id CHAR(36) DEFAULT NULL,
  entity_fqn VARCHAR(768) DEFAULT NULL,
  entity_fqn_hash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  event_json LONGTEXT NOT NULL,
  created_at BIGINT DEFAULT (UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000),
  PRIMARY KEY (id),
  UNIQUE KEY idx_audit_log_event_change_event_id (change_event_id),
  KEY idx_audit_log_event_ts (event_ts DESC),
  KEY idx_audit_log_event_user_ts (user_name, event_ts DESC),
  KEY idx_audit_log_event_entity_hash_ts (entity_fqn_hash, event_ts DESC),
  KEY idx_audit_log_actor_type_ts (actor_type, event_ts DESC),
  KEY idx_audit_log_service_name_ts (service_name, event_ts DESC),
  KEY idx_audit_log_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



-- Add enabled field to test_definition table for Rules Library feature
-- This allows administrators to enable/disable test definitions in the rules library

-- Add virtual column for enabled field
-- CAST is needed to convert JSON boolean (true/false) to TINYINT (1/0)
ALTER TABLE test_definition
  ADD COLUMN enabled TINYINT(1)
  GENERATED ALWAYS AS (COALESCE(CAST(json_extract(json, '$.enabled') AS UNSIGNED), 1))
  VIRTUAL;

-- Add index for filtering enabled/disabled test definitions
CREATE INDEX idx_test_definition_enabled ON test_definition(enabled);

-- Set all existing test definitions to enabled by default
UPDATE test_definition
  SET json = JSON_SET(json, '$.enabled', true)
  WHERE json_extract(json, '$.enabled') IS NULL;

-- Migrate termsOfUse from string to object with content and inherited fields
-- This converts existing termsOfUse string values to the new object structure: { "content": "...", "inherited": false }
UPDATE data_contract_entity
  SET json = JSON_SET(
    json,
    '$.termsOfUse',
    JSON_OBJECT('content', JSON_UNQUOTE(JSON_EXTRACT(json, '$.termsOfUse')), 'inherited', false)
  )
  WHERE JSON_TYPE(JSON_EXTRACT(json, '$.termsOfUse')) = 'STRING';

-- Add updatedAt generated column to entity_extension table for efficient timestamp-based queries
-- This supports the listEntityHistoryByTimestamp API endpoint for retrieving entity versions within a time range
ALTER TABLE entity_extension
  ADD COLUMN updatedAt BIGINT UNSIGNED
  GENERATED ALWAYS AS (CAST(json_unquote(json_extract(json, '$.updatedAt')) AS UNSIGNED))
  STORED;

-- Create composite index for timestamp-based queries with cursor pagination
-- This index supports queries that filter by updatedAt range and order by (updatedAt DESC, id DESC)
CREATE INDEX idx_entity_extension_updated_at_id ON entity_extension(updatedAt DESC, id DESC);

-- Add composite indexes on entity tables for timestamp-based history queries with cursor pagination
CREATE INDEX idx_table_entity_updated_at_id ON table_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_database_entity_updated_at_id ON database_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_database_schema_entity_updated_at_id ON database_schema_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_dashboard_entity_updated_at_id ON dashboard_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_pipeline_entity_updated_at_id ON pipeline_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_topic_entity_updated_at_id ON topic_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_chart_entity_updated_at_id ON chart_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_ml_model_entity_updated_at_id ON ml_model_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_stored_procedure_entity_updated_at_id ON stored_procedure_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_dashboard_data_model_entity_updated_at_id ON dashboard_data_model_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_storage_container_entity_updated_at_id ON storage_container_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_search_index_entity_updated_at_id ON search_index_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_glossary_entity_updated_at_id ON glossary_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_glossary_term_entity_updated_at_id ON glossary_term_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_tag_updated_at_id ON tag(updatedAt DESC, id DESC);
CREATE INDEX idx_classification_updated_at_id ON classification(updatedAt DESC, id DESC);
CREATE INDEX idx_data_product_entity_updated_at_id ON data_product_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_domain_entity_updated_at_id ON domain_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_user_entity_updated_at_id ON user_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_team_entity_updated_at_id ON team_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_dbservice_entity_updated_at_id ON dbservice_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_messaging_service_entity_updated_at_id ON messaging_service_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_dashboard_service_entity_updated_at_id ON dashboard_service_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_pipeline_service_entity_updated_at_id ON pipeline_service_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_storage_service_entity_updated_at_id ON storage_service_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_mlmodel_service_entity_updated_at_id ON mlmodel_service_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_metadata_service_entity_updated_at_id ON metadata_service_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_search_service_entity_updated_at_id ON search_service_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_api_service_entity_updated_at_id ON api_service_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_ingestion_pipeline_entity_updated_at_id ON ingestion_pipeline_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_test_suite_updated_at_id ON test_suite(updatedAt DESC, id DESC);
CREATE INDEX idx_test_case_updated_at_id ON test_case(updatedAt DESC, id DESC);
CREATE INDEX idx_api_collection_entity_updated_at_id ON api_collection_entity(updatedAt DESC, id DESC);
CREATE INDEX idx_api_endpoint_entity_updated_at_id ON api_endpoint_entity(updatedAt DESC, id DESC);

-- Add metadata column to tag_usage table
ALTER TABLE tag_usage ADD metadata JSON NULL;

-- Upgrade appliedAt to microsecond precision to match PostgreSQL behavior.
-- Without this, MySQL returns second-precision timestamps which cause spurious
-- diffs in JSON patch operations, leading to deserialization failures.
ALTER TABLE tag_usage MODIFY appliedAt TIMESTAMP(6) NULL DEFAULT CURRENT_TIMESTAMP(6);

-- Distributed Search Indexing Tables

-- Table to track reindex jobs across distributed servers
CREATE TABLE IF NOT EXISTS search_index_job (
    id VARCHAR(36) NOT NULL,
    status VARCHAR(32) NOT NULL,
    jobConfiguration JSON NOT NULL,
    targetIndexPrefix VARCHAR(255),
    stagedIndexMapping JSON,
    totalRecords BIGINT NOT NULL DEFAULT 0,
    processedRecords BIGINT NOT NULL DEFAULT 0,
    successRecords BIGINT NOT NULL DEFAULT 0,
    failedRecords BIGINT NOT NULL DEFAULT 0,
    stats JSON,
    createdBy VARCHAR(256) NOT NULL,
    createdAt BIGINT NOT NULL,
    startedAt BIGINT,
    completedAt BIGINT,
    updatedAt BIGINT NOT NULL,
    errorMessage TEXT,
    -- Legacy fields (no longer used but kept for compatibility)
    registrationDeadline BIGINT,
    registeredServerCount INT,
    PRIMARY KEY (id),
    INDEX idx_search_index_job_status (status),
    INDEX idx_search_index_job_created (createdAt DESC)
);

-- Table to track partitions within a reindex job
CREATE TABLE IF NOT EXISTS search_index_partition (
    id VARCHAR(36) NOT NULL,
    jobId VARCHAR(36) NOT NULL,
    entityType VARCHAR(128) NOT NULL,
    partitionIndex INT NOT NULL,
    rangeStart BIGINT NOT NULL,
    rangeEnd BIGINT NOT NULL,
    estimatedCount BIGINT NOT NULL,
    workUnits BIGINT NOT NULL,
    priority INT NOT NULL DEFAULT 50,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    processingCursor BIGINT NOT NULL DEFAULT 0,
    processedCount BIGINT NOT NULL DEFAULT 0,
    successCount BIGINT NOT NULL DEFAULT 0,
    failedCount BIGINT NOT NULL DEFAULT 0,
    assignedServer VARCHAR(255),
    claimedAt BIGINT,
    startedAt BIGINT,
    completedAt BIGINT,
    lastUpdateAt BIGINT,
    lastError TEXT,
    retryCount INT NOT NULL DEFAULT 0,
    claimableAt BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_partition_job_entity_idx (jobId, entityType, partitionIndex),
    INDEX idx_partition_job (jobId),
    INDEX idx_partition_status_priority (status, priority DESC),
    INDEX idx_partition_claimed (claimedAt),
    INDEX idx_partition_assigned_server (jobId, assignedServer),
    INDEX idx_partition_claimable (jobId, status, claimableAt),
    CONSTRAINT fk_partition_job FOREIGN KEY (jobId) REFERENCES search_index_job(id) ON DELETE CASCADE
);

-- Table for distributed lock to ensure only one reindex job runs at a time
CREATE TABLE IF NOT EXISTS search_reindex_lock (
    lockKey VARCHAR(64) NOT NULL,
    jobId VARCHAR(36) NOT NULL,
    serverId VARCHAR(255) NOT NULL,
    acquiredAt BIGINT NOT NULL,
    lastHeartbeat BIGINT NOT NULL,
    expiresAt BIGINT NOT NULL,
    PRIMARY KEY (lockKey)
);

-- Search Index Failures Table
-- Purpose: Store individual failure records for entities that fail during reindexing

CREATE TABLE IF NOT EXISTS search_index_failures (
    id VARCHAR(36) NOT NULL,
    jobId VARCHAR(36) NOT NULL,
    serverId VARCHAR(256) NOT NULL,
    entityType VARCHAR(256) NOT NULL,
    entityId VARCHAR(36),
    entityFqn VARCHAR(1024),
    failureStage VARCHAR(32) NOT NULL,
    errorMessage LONGTEXT,
    stackTrace LONGTEXT,
    timestamp BIGINT NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_search_index_failures_job_id (jobId),
    INDEX idx_search_index_failures_server_id (serverId),
    INDEX idx_search_index_failures_entity_type (entityType),
    INDEX idx_search_index_failures_timestamp (timestamp)
);

-- Search Index Server Stats Table
-- Purpose: Track per-server stats in distributed indexing mode

CREATE TABLE IF NOT EXISTS search_index_server_stats (
    id VARCHAR(36) NOT NULL,
    jobId VARCHAR(36) NOT NULL,
    serverId VARCHAR(256) NOT NULL,
    readerSuccess BIGINT DEFAULT 0,
    readerFailed BIGINT DEFAULT 0,
    readerWarnings BIGINT DEFAULT 0,
    sinkTotal BIGINT DEFAULT 0,
    sinkSuccess BIGINT DEFAULT 0,
    sinkFailed BIGINT DEFAULT 0,
    sinkWarnings BIGINT DEFAULT 0,
    entityBuildFailures BIGINT DEFAULT 0,
    partitionsCompleted INT DEFAULT 0,
    partitionsFailed INT DEFAULT 0,
    lastUpdatedAt BIGINT NOT NULL,
    PRIMARY KEY (id),
    UNIQUE INDEX idx_search_index_server_stats_job_server (jobId, serverId),
    INDEX idx_search_index_server_stats_job_id (jobId)
);

-- Create Learning Resource Entity Table
CREATE TABLE IF NOT EXISTS learning_resource_entity (
  id varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,'$.id'))) STORED NOT NULL,
  name varchar(3072) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,'$.fullyQualifiedName'))) VIRTUAL,
  fqnHash varchar(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  json json NOT NULL,
  updatedAt bigint UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(`json`,'$.updatedAt'))) VIRTUAL NOT NULL,
  updatedBy varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,'$.updatedBy'))) VIRTUAL NOT NULL,
  deleted TINYINT(1) GENERATED ALWAYS AS (IF(json_extract(json,'$.deleted') = TRUE, 1, 0)) VIRTUAL,
  PRIMARY KEY (id),
  UNIQUE KEY fqnHash (fqnHash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- DELETE old workflow instances where status is null
DELETE FROM workflow_instance_time_series
WHERE JSON_EXTRACT(json, '$.status') IS NULL;

-- DELETE old workflow instance state  where status is null
DELETE FROM workflow_instance_state_time_series
WHERE JSON_EXTRACT(json, '$.status') IS NULL;

-- Widen entityLink generated column from VARCHAR(255) to TEXT
-- The entity link from workflow variables can exceed 255 characters for deeply nested entities
ALTER TABLE workflow_instance_time_series
MODIFY COLUMN entityLink TEXT GENERATED ALWAYS AS (json ->> '$.variables.global_relatedEntity');

-- Add process and vector stage columns to search_index_server_stats table
-- These columns support the 4-stage pipeline model (Reader, Process, Sink, Vector) for search indexing stats

ALTER TABLE search_index_server_stats ADD COLUMN processSuccess BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN processFailed BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN vectorSuccess BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN vectorFailed BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN vectorWarnings BIGINT DEFAULT 0;

-- Add entityType column to support per-entity stats tracking
-- Stats are now tracked per (jobId, serverId, entityType) instead of (jobId, serverId)
ALTER TABLE search_index_server_stats ADD COLUMN entityType VARCHAR(128) NOT NULL DEFAULT 'unknown';

-- Drop old unique index and create new one with entityType
ALTER TABLE search_index_server_stats DROP INDEX idx_search_index_server_stats_job_server;
CREATE UNIQUE INDEX idx_search_index_server_stats_job_server_entity
    ON search_index_server_stats (jobId, serverId, entityType);

-- Remove deprecated columns (entityBuildFailures is redundant - failures are tracked as processFailed)
-- sinkTotal and sinkWarnings are not needed
ALTER TABLE search_index_server_stats DROP COLUMN entityBuildFailures;
ALTER TABLE search_index_server_stats DROP COLUMN sinkTotal;
ALTER TABLE search_index_server_stats DROP COLUMN sinkWarnings;

-- Create ai_application_entity table
CREATE TABLE IF NOT EXISTS ai_application_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.impersonatedBy') VIRTUAL,
    deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
    PRIMARY KEY (id),
    UNIQUE KEY unique_name (fqnHash),
    INDEX name_index (name),
    INDEX deleted_index (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI Application entities';

-- Create llm_model_entity table
CREATE TABLE IF NOT EXISTS llm_model_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.impersonatedBy') VIRTUAL,
    deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
    PRIMARY KEY (id),
    UNIQUE KEY unique_name (fqnHash),
    INDEX name_index (name),
    INDEX deleted_index (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='LLM Model entities';

-- Create prompt_template_entity table
CREATE TABLE IF NOT EXISTS prompt_template_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.impersonatedBy') VIRTUAL,
    deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
    PRIMARY KEY (id),
    UNIQUE KEY unique_name (fqnHash),
    INDEX name_index (name),
    INDEX deleted_index (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Prompt Template entities';

-- Create agent_execution_entity table
CREATE TABLE IF NOT EXISTS agent_execution_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    agentId VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.agentId') STORED NOT NULL,
    json JSON NOT NULL,
    timestamp BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.timestamp') NOT NULL,
    PRIMARY KEY (id),
    INDEX agent_index (agentId),
    INDEX timestamp_index (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI Agent Execution logs';

-- Create ai_governance_policy_entity table
CREATE TABLE IF NOT EXISTS ai_governance_policy_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.impersonatedBy') VIRTUAL,
    deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
    PRIMARY KEY (id),
    UNIQUE KEY unique_name (fqnHash),
    INDEX name_index (name),
    INDEX deleted_index (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='AI Governance Policy entities';

-- Create llm_service_entity table
CREATE TABLE IF NOT EXISTS llm_service_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.id'))) STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.name'))) VIRTUAL NOT NULL,
    serviceType VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.serviceType'))) VIRTUAL NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.updatedAt'))) VIRTUAL NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.updatedBy'))) VIRTUAL NOT NULL,
    impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.impersonatedBy') VIRTUAL,
    deleted TINYINT(1) GENERATED ALWAYS AS (json_extract(`json`, '$.deleted')) VIRTUAL,
    nameHash VARCHAR(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY nameHash (nameHash),
    INDEX name_index (name),
    INDEX service_type_index (serviceType),
    INDEX deleted_index (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='LLM Service entities';


