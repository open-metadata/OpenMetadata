-- Update ApplicationBotRole to include Trigger operation
UPDATE policy_entity
SET json = jsonb_set(json::jsonb, '{rules,0,operations}', (json->'rules'->0->'operations')::jsonb || '["Trigger"]'::jsonb)
WHERE name = 'ApplicationBotPolicy'
  AND json->'rules'->0->'operations' IS NOT NULL
  AND NOT (json->'rules'->0->'operations' @> '"Trigger"'::jsonb);

-- Create table for persisted audit log events
CREATE TABLE IF NOT EXISTS audit_log_event (
    id BIGSERIAL PRIMARY KEY,
    change_event_id UUID NOT NULL,
    event_ts BIGINT NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    user_name VARCHAR(256),
    actor_type VARCHAR(32) DEFAULT 'USER',
    impersonated_by VARCHAR(256) DEFAULT NULL,
    service_name VARCHAR(256) DEFAULT NULL,
    entity_type VARCHAR(128),
    entity_id UUID,
    entity_fqn VARCHAR(768),
    entity_fqn_hash VARCHAR(768),
    event_json TEXT NOT NULL,
    created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- Add indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_type_ts ON audit_log_event (actor_type, event_ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_service_name_ts ON audit_log_event (service_name, event_ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log_event (created_at);


-- Add enabled field to test_definition table for Rules Library feature
-- This allows administrators to enable/disable test definitions in the rules library

-- Add generated column for enabled field with default true for existing rows
ALTER TABLE test_definition
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN GENERATED ALWAYS AS (
    COALESCE((json ->> 'enabled')::boolean, true)
  ) STORED;

-- Add index for filtering enabled/disabled test definitions
CREATE INDEX IF NOT EXISTS idx_test_definition_enabled ON test_definition(enabled);

-- Set all existing test definitions to enabled by default
UPDATE test_definition
  SET json = jsonb_set(json::jsonb, '{enabled}', 'true'::jsonb, true)::json
  WHERE json ->> 'enabled' IS NULL;

-- Migrate termsOfUse from string to object with content and inherited fields
-- This converts existing termsOfUse string values to the new object structure: { "content": "...", "inherited": false }
UPDATE data_contract_entity
  SET json = jsonb_set(
    json::jsonb,
    '{termsOfUse}',
    jsonb_build_object('content', json ->> 'termsOfUse', 'inherited', false)
  )::json
  WHERE jsonb_typeof((json::jsonb) -> 'termsOfUse') = 'string';

CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_log_event_change_event_id
ON audit_log_event (change_event_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_ts
ON audit_log_event (event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_user_ts
ON audit_log_event (user_name, event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_entity_hash_ts
ON audit_log_event (entity_fqn_hash, event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_type_ts
ON audit_log_event (actor_type, event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_service_name_ts
ON audit_log_event (service_name, event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
ON audit_log_event (created_at);

-- Add updatedAt generated column to entity_extension table for efficient timestamp-based queries
-- This supports the listEntityHistoryByTimestamp API endpoint for retrieving entity versions within a time range
ALTER TABLE entity_extension
  ADD COLUMN IF NOT EXISTS updatedAt BIGINT GENERATED ALWAYS AS (
    (json ->> 'updatedAt')::BIGINT
  ) STORED;

-- Create composite index for timestamp-based queries with cursor pagination
-- This index supports queries that filter by updatedAt range and order by (updatedAt DESC, id DESC)
CREATE INDEX IF NOT EXISTS idx_entity_extension_updated_at_id ON entity_extension(updatedAt DESC, id DESC);

-- Add composite indexes on entity tables for timestamp-based history queries with cursor pagination
CREATE INDEX IF NOT EXISTS idx_table_entity_updated_at_id ON table_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_database_entity_updated_at_id ON database_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_database_schema_entity_updated_at_id ON database_schema_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_entity_updated_at_id ON dashboard_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_entity_updated_at_id ON pipeline_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_topic_entity_updated_at_id ON topic_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_chart_entity_updated_at_id ON chart_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ml_model_entity_updated_at_id ON ml_model_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_stored_procedure_entity_updated_at_id ON stored_procedure_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_data_model_entity_updated_at_id ON dashboard_data_model_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_storage_container_entity_updated_at_id ON storage_container_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_search_index_entity_updated_at_id ON search_index_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_glossary_entity_updated_at_id ON glossary_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_glossary_term_entity_updated_at_id ON glossary_term_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_tag_updated_at_id ON tag(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_classification_updated_at_id ON classification(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_data_product_entity_updated_at_id ON data_product_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_domain_entity_updated_at_id ON domain_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_user_entity_updated_at_id ON user_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_team_entity_updated_at_id ON team_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_dbservice_entity_updated_at_id ON dbservice_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_messaging_service_entity_updated_at_id ON messaging_service_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_service_entity_updated_at_id ON dashboard_service_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_service_entity_updated_at_id ON pipeline_service_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_storage_service_entity_updated_at_id ON storage_service_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_mlmodel_service_entity_updated_at_id ON mlmodel_service_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_metadata_service_entity_updated_at_id ON metadata_service_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_search_service_entity_updated_at_id ON search_service_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_api_service_entity_updated_at_id ON api_service_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_pipeline_entity_updated_at_id ON ingestion_pipeline_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_test_suite_updated_at_id ON test_suite(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_test_case_updated_at_id ON test_case(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_api_collection_entity_updated_at_id ON api_collection_entity(updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_api_endpoint_entity_updated_at_id ON api_endpoint_entity(updatedAt DESC, id DESC);


-- Add metadata column to tag_usage table
ALTER TABLE tag_usage ADD COLUMN IF NOT EXISTS metadata JSON;

-- Distributed Search Indexing Tables

-- Table to track reindex jobs across distributed servers
CREATE TABLE IF NOT EXISTS search_index_job (
    id VARCHAR(36) NOT NULL,
    status VARCHAR(32) NOT NULL,
    jobConfiguration JSONB NOT NULL,
    targetIndexPrefix VARCHAR(255),
    stagedIndexMapping JSONB,
    totalRecords BIGINT NOT NULL DEFAULT 0,
    processedRecords BIGINT NOT NULL DEFAULT 0,
    successRecords BIGINT NOT NULL DEFAULT 0,
    failedRecords BIGINT NOT NULL DEFAULT 0,
    stats JSONB,
    createdBy VARCHAR(256) NOT NULL,
    createdAt BIGINT NOT NULL,
    startedAt BIGINT,
    completedAt BIGINT,
    updatedAt BIGINT NOT NULL,
    errorMessage TEXT,
    -- Legacy fields (no longer used but kept for compatibility)
    registrationDeadline BIGINT,
    registeredServerCount INT,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_search_index_job_status ON search_index_job(status);
CREATE INDEX IF NOT EXISTS idx_search_index_job_created ON search_index_job(createdAt DESC);

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
    UNIQUE (jobId, entityType, partitionIndex),
    CONSTRAINT fk_partition_job FOREIGN KEY (jobId) REFERENCES search_index_job(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_partition_job ON search_index_partition(jobId);
CREATE INDEX IF NOT EXISTS idx_partition_status_priority ON search_index_partition(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_partition_claimed ON search_index_partition(claimedAt);
CREATE INDEX IF NOT EXISTS idx_partition_assigned_server ON search_index_partition(jobId, assignedServer);
CREATE INDEX IF NOT EXISTS idx_partition_claimable ON search_index_partition(jobId, status, claimableAt);

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
    errorMessage TEXT,
    stackTrace TEXT,
    timestamp BIGINT NOT NULL,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_search_index_failures_job_id ON search_index_failures(jobId);
CREATE INDEX IF NOT EXISTS idx_search_index_failures_server_id ON search_index_failures(serverId);
CREATE INDEX IF NOT EXISTS idx_search_index_failures_entity_type ON search_index_failures(entityType);
CREATE INDEX IF NOT EXISTS idx_search_index_failures_timestamp ON search_index_failures(timestamp);

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
    UNIQUE (jobId, serverId)
);

CREATE INDEX IF NOT EXISTS idx_search_index_server_stats_job_id ON search_index_server_stats(jobId);

-- Create Learning Resource Entity Table
CREATE TABLE IF NOT EXISTS learning_resource_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(3072) GENERATED ALWAYS AS ((json ->> 'fullyQualifiedName'::text)) STORED,
    fqnhash character varying(256) NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnhash)
);

-- Set FINISHED for completed workflow instances where status is null
UPDATE workflow_instance_time_series 
SET json = jsonb_set(json, '{status}', '"FINISHED"'::jsonb, true)
WHERE json->>'status' IS NULL 
  AND json->>'endedAt' IS NOT NULL;

-- Set FAILURE for incomplete workflow instances where status is null
UPDATE workflow_instance_time_series 
SET json = jsonb_set(json, '{status}', '"FAILURE"'::jsonb, true)
WHERE json->>'status' IS NULL 
  AND json->>'endedAt' IS NULL;

-- Set FINISHED for completed workflow instance states where status is null
UPDATE workflow_instance_state_time_series
SET json = jsonb_set(json, '{status}', '"FINISHED"'::jsonb, true)
WHERE json->>'status' IS NULL
  AND json->>'endedAt' IS NOT NULL;

-- Set FAILURE for incomplete workflow instance states where status is null
UPDATE workflow_instance_state_time_series
SET json = jsonb_set(json, '{status}', '"FAILURE"'::jsonb, true)
WHERE json->>'status' IS NULL
  AND json->>'endedAt' IS NULL;

-- Widen entityLink generated column from VARCHAR(255) to TEXT
-- The entity link from workflow variables can exceed 255 characters for deeply nested entities
ALTER TABLE workflow_instance_time_series ALTER COLUMN entityLink TYPE TEXT;

-- Add process and vector stage columns to search_index_server_stats table
-- These columns support the 4-stage pipeline model (Reader, Process, Sink, Vector) for search indexing stats

ALTER TABLE search_index_server_stats ADD COLUMN IF NOT EXISTS processSuccess BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN IF NOT EXISTS processFailed BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN IF NOT EXISTS vectorSuccess BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN IF NOT EXISTS vectorFailed BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN IF NOT EXISTS vectorWarnings BIGINT DEFAULT 0;

-- Add entityType column to support per-entity stats tracking
-- Stats are now tracked per (jobId, serverId, entityType) instead of (jobId, serverId)
ALTER TABLE search_index_server_stats ADD COLUMN IF NOT EXISTS entityType VARCHAR(128) NOT NULL DEFAULT 'unknown';

-- Drop old unique constraint and index, then create new one with entityType
ALTER TABLE search_index_server_stats DROP CONSTRAINT IF EXISTS search_index_server_stats_jobid_serverid_key;
DROP INDEX IF EXISTS idx_search_index_server_stats_job_server;
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_index_server_stats_job_server_entity
    ON search_index_server_stats (jobId, serverId, entityType);

-- Remove deprecated columns (entityBuildFailures is redundant - failures are tracked as processFailed)
-- sinkTotal and sinkWarnings are not needed
ALTER TABLE search_index_server_stats DROP COLUMN IF EXISTS entityBuildFailures;
ALTER TABLE search_index_server_stats DROP COLUMN IF EXISTS sinkTotal;
ALTER TABLE search_index_server_stats DROP COLUMN IF EXISTS sinkWarnings;

-- AI Application and LLM Model entities for AI/LLM governance
-- Version 1.12.0

-- Create ai_application_entity table
CREATE TABLE IF NOT EXISTS ai_application_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json->>'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json->>'name') STORED NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json->>'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json->>'updatedBy') STORED NOT NULL,
    impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json->>'impersonatedBy') STORED,
    deleted BOOLEAN GENERATED ALWAYS AS ((json->>'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

CREATE INDEX IF NOT EXISTS ai_application_name_index ON ai_application_entity(name);
CREATE INDEX IF NOT EXISTS ai_application_deleted_index ON ai_application_entity(deleted);

COMMENT ON TABLE ai_application_entity IS 'AI Application entities';

-- Create llm_model_entity table
CREATE TABLE IF NOT EXISTS llm_model_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json->>'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json->>'name') STORED NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json->>'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json->>'updatedBy') STORED NOT NULL,
    impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json->>'impersonatedBy') STORED,
    deleted BOOLEAN GENERATED ALWAYS AS ((json->>'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

CREATE INDEX IF NOT EXISTS llm_model_name_index ON llm_model_entity(name);
CREATE INDEX IF NOT EXISTS llm_model_deleted_index ON llm_model_entity(deleted);

COMMENT ON TABLE llm_model_entity IS 'LLM Model entities';

-- Create prompt_template_entity table
CREATE TABLE IF NOT EXISTS prompt_template_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json->>'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json->>'name') STORED NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json->>'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json->>'updatedBy') STORED NOT NULL,
    impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json->>'impersonatedBy') STORED,
    deleted BOOLEAN GENERATED ALWAYS AS ((json->>'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

CREATE INDEX IF NOT EXISTS prompt_template_name_index ON prompt_template_entity(name);
CREATE INDEX IF NOT EXISTS prompt_template_deleted_index ON prompt_template_entity(deleted);

COMMENT ON TABLE prompt_template_entity IS 'Prompt Template entities';

-- Create agent_execution_entity table
CREATE TABLE IF NOT EXISTS agent_execution_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json->>'id') STORED NOT NULL,
    agentId VARCHAR(36) GENERATED ALWAYS AS (json->>'agentId') STORED NOT NULL,
    json JSONB NOT NULL,
    timestamp BIGINT GENERATED ALWAYS AS ((json->>'timestamp')::bigint) STORED NOT NULL,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS agent_execution_agent_index ON agent_execution_entity(agentId);
CREATE INDEX IF NOT EXISTS agent_execution_timestamp_index ON agent_execution_entity(timestamp);

COMMENT ON TABLE agent_execution_entity IS 'AI Agent Execution logs';

-- Create ai_governance_policy_entity table
CREATE TABLE IF NOT EXISTS ai_governance_policy_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json->>'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json->>'name') STORED NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json->>'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json->>'updatedBy') STORED NOT NULL,
    impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json->>'impersonatedBy') STORED,
    deleted BOOLEAN GENERATED ALWAYS AS ((json->>'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

CREATE INDEX IF NOT EXISTS ai_governance_policy_name_index ON ai_governance_policy_entity(name);
CREATE INDEX IF NOT EXISTS ai_governance_policy_deleted_index ON ai_governance_policy_entity(deleted);

COMMENT ON TABLE ai_governance_policy_entity IS 'AI Governance Policy entities';

-- Create llm_service_entity table
CREATE TABLE IF NOT EXISTS llm_service_entity (
    id VARCHAR(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    serviceType VARCHAR(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json->>'impersonatedBy') STORED,
    deleted BOOLEAN GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    nameHash VARCHAR(256) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (nameHash)
);

CREATE INDEX IF NOT EXISTS llm_service_name_index ON llm_service_entity(name);
CREATE INDEX IF NOT EXISTS llm_service_type_index ON llm_service_entity(serviceType);
CREATE INDEX IF NOT EXISTS llm_service_deleted_index ON llm_service_entity(deleted);

COMMENT ON TABLE llm_service_entity IS 'LLM Service entities';
