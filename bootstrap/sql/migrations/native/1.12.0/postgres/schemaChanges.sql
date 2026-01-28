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

-- OAuth 2.0 Persistence Schema for MCP Server Integration
-- This migration adds tables to support OAuth 2.0 authorization flow for MCP server authentication

-- OAuth Clients Table
-- Stores registered OAuth 2.0 client applications
CREATE TABLE IF NOT EXISTS oauth_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id VARCHAR(255) UNIQUE NOT NULL,
    client_secret_encrypted TEXT,
    client_name VARCHAR(255),
    redirect_uris JSONB NOT NULL DEFAULT '[]'::jsonb,
    grant_types JSONB NOT NULL DEFAULT '["authorization_code", "refresh_token"]'::jsonb,
    token_endpoint_auth_method VARCHAR(50) NOT NULL DEFAULT 'client_secret_basic',
    scopes JSONB NOT NULL DEFAULT '["read", "write"]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT oauth_clients_client_id_check CHECK (char_length(client_id) > 0),
    CONSTRAINT oauth_clients_redirect_uris_check CHECK (jsonb_typeof(redirect_uris) = 'array'),
    CONSTRAINT oauth_clients_grant_types_check CHECK (jsonb_typeof(grant_types) = 'array'),
    CONSTRAINT oauth_clients_scopes_check CHECK (jsonb_typeof(scopes) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON oauth_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_clients_created_at ON oauth_clients(created_at);

COMMENT ON TABLE oauth_clients IS 'OAuth 2.0 registered client applications';
COMMENT ON COLUMN oauth_clients.client_id IS 'Unique client identifier';
COMMENT ON COLUMN oauth_clients.client_secret_encrypted IS 'Encrypted client secret for confidential clients';
COMMENT ON COLUMN oauth_clients.redirect_uris IS 'Array of allowed redirect URIs for authorization code flow';
COMMENT ON COLUMN oauth_clients.grant_types IS 'Array of allowed OAuth grant types';
COMMENT ON COLUMN oauth_clients.token_endpoint_auth_method IS 'Authentication method for token endpoint (e.g., client_secret_basic, client_secret_post)';

-- OAuth Authorization Codes Table
-- Stores temporary authorization codes for authorization code flow
CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(512) UNIQUE NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    code_challenge VARCHAR(255),
    code_challenge_method VARCHAR(10),
    redirect_uri TEXT NOT NULL,
    scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
    expires_at BIGINT NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT oauth_authorization_codes_fk_client FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    CONSTRAINT oauth_authorization_codes_expires_check CHECK (expires_at > 0),
    CONSTRAINT oauth_authorization_codes_code_check CHECK (char_length(code) > 0),
    CONSTRAINT oauth_authorization_codes_user_check CHECK (char_length(user_name) > 0),
    CONSTRAINT oauth_authorization_codes_scopes_check CHECK (jsonb_typeof(scopes) = 'array'),
    CONSTRAINT oauth_authorization_codes_challenge_method_check CHECK (
        code_challenge_method IS NULL OR
        code_challenge_method IN ('plain', 'S256')
    )
);

CREATE INDEX IF NOT EXISTS idx_oauth_authz_codes_code ON oauth_authorization_codes(code);
CREATE INDEX IF NOT EXISTS idx_oauth_authz_codes_client_id ON oauth_authorization_codes(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_authz_codes_user ON oauth_authorization_codes(user_name);
CREATE INDEX IF NOT EXISTS idx_oauth_authz_codes_expires_at ON oauth_authorization_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_authz_codes_created_at ON oauth_authorization_codes(created_at);

COMMENT ON TABLE oauth_authorization_codes IS 'Temporary authorization codes for OAuth 2.0 authorization code flow';
COMMENT ON COLUMN oauth_authorization_codes.code IS 'Unique authorization code string';
COMMENT ON COLUMN oauth_authorization_codes.user_name IS 'Username of the user who initiated the authorization';
COMMENT ON COLUMN oauth_authorization_codes.code_challenge IS 'PKCE code challenge for public clients';
COMMENT ON COLUMN oauth_authorization_codes.code_challenge_method IS 'PKCE code challenge method (plain or S256)';
COMMENT ON COLUMN oauth_authorization_codes.expires_at IS 'Unix timestamp (milliseconds) when code expires';
COMMENT ON COLUMN oauth_authorization_codes.used IS 'Whether the authorization code has been exchanged for tokens';

-- OAuth Access Tokens Table
-- Stores active access tokens for API authentication
CREATE TABLE IF NOT EXISTS oauth_access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    access_token_encrypted TEXT NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
    expires_at BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT oauth_access_tokens_fk_client FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    CONSTRAINT oauth_access_tokens_expires_check CHECK (expires_at > 0),
    CONSTRAINT oauth_access_tokens_hash_check CHECK (char_length(token_hash) > 0),
    CONSTRAINT oauth_access_tokens_user_check CHECK (char_length(user_name) > 0),
    CONSTRAINT oauth_access_tokens_scopes_check CHECK (jsonb_typeof(scopes) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_hash ON oauth_access_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_client_id ON oauth_access_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_user ON oauth_access_tokens(user_name);
CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_expires_at ON oauth_access_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_created_at ON oauth_access_tokens(created_at);

COMMENT ON TABLE oauth_access_tokens IS 'Active OAuth 2.0 access tokens for API authentication';
COMMENT ON COLUMN oauth_access_tokens.token_hash IS 'SHA-256 hash of the access token for lookup';
COMMENT ON COLUMN oauth_access_tokens.access_token_encrypted IS 'Encrypted access token value';
COMMENT ON COLUMN oauth_access_tokens.user_name IS 'Username of the user who authorized the token';
COMMENT ON COLUMN oauth_access_tokens.expires_at IS 'Unix timestamp (milliseconds) when token expires';

-- OAuth Refresh Tokens Table
-- Stores refresh tokens for obtaining new access tokens
CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    refresh_token_encrypted TEXT NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
    expires_at BIGINT NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT oauth_refresh_tokens_fk_client FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    CONSTRAINT oauth_refresh_tokens_expires_check CHECK (expires_at > 0),
    CONSTRAINT oauth_refresh_tokens_hash_check CHECK (char_length(token_hash) > 0),
    CONSTRAINT oauth_refresh_tokens_user_check CHECK (char_length(user_name) > 0),
    CONSTRAINT oauth_refresh_tokens_scopes_check CHECK (jsonb_typeof(scopes) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_hash ON oauth_refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_client_id ON oauth_refresh_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_user ON oauth_refresh_tokens(user_name);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_revoked ON oauth_refresh_tokens(revoked);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_expires_at ON oauth_refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_created_at ON oauth_refresh_tokens(created_at);

COMMENT ON TABLE oauth_refresh_tokens IS 'OAuth 2.0 refresh tokens for obtaining new access tokens';
COMMENT ON COLUMN oauth_refresh_tokens.token_hash IS 'SHA-256 hash of the refresh token for lookup';
COMMENT ON COLUMN oauth_refresh_tokens.refresh_token_encrypted IS 'Encrypted refresh token value';
COMMENT ON COLUMN oauth_refresh_tokens.user_name IS 'Username of the user who authorized the token';
COMMENT ON COLUMN oauth_refresh_tokens.revoked IS 'Whether the refresh token has been revoked';
COMMENT ON COLUMN oauth_refresh_tokens.expires_at IS 'Unix timestamp (milliseconds) when token expires';

-- OAuth Audit Log Table
-- Tracks all OAuth-related events for security and compliance
CREATE TABLE IF NOT EXISTS oauth_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    client_id VARCHAR(255),
    user_name VARCHAR(255),
    success BOOLEAN NOT NULL,
    error_message TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT oauth_audit_log_event_type_check CHECK (
        event_type IN (
            'authorize',
            'token_exchange',
            'token_refresh',
            'token_revoke',
            'client_register',
            'client_update',
            'client_delete',
            'authorization_code_used',
            'token_expired',
            'invalid_grant',
            'invalid_client',
            'unauthorized_client',
            'access_denied'
        )
    ),
    CONSTRAINT oauth_audit_log_metadata_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_oauth_audit_log_event_type ON oauth_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_oauth_audit_log_client_id ON oauth_audit_log(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_audit_log_user ON oauth_audit_log(user_name);
CREATE INDEX IF NOT EXISTS idx_oauth_audit_log_success ON oauth_audit_log(success);
CREATE INDEX IF NOT EXISTS idx_oauth_audit_log_created_at ON oauth_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oauth_audit_log_ip_address ON oauth_audit_log(ip_address);

COMMENT ON TABLE oauth_audit_log IS 'Audit log for all OAuth 2.0 events and security-related activities';
COMMENT ON COLUMN oauth_audit_log.event_type IS 'Type of OAuth event (authorize, token_exchange, token_refresh, etc.)';
COMMENT ON COLUMN oauth_audit_log.client_id IS 'OAuth client that triggered the event';
COMMENT ON COLUMN oauth_audit_log.user_name IS 'User involved in the event';
COMMENT ON COLUMN oauth_audit_log.success IS 'Whether the operation succeeded';
COMMENT ON COLUMN oauth_audit_log.error_message IS 'Error message if operation failed';
COMMENT ON COLUMN oauth_audit_log.ip_address IS 'IP address of the client';
COMMENT ON COLUMN oauth_audit_log.user_agent IS 'User agent string from the client';
COMMENT ON COLUMN oauth_audit_log.metadata IS 'Additional contextual information as JSON';

-- Optimize autovacuum for high-write tables
ALTER TABLE oauth_authorization_codes SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05,
    autovacuum_vacuum_threshold = 50,
    autovacuum_analyze_threshold = 50
);

ALTER TABLE oauth_access_tokens SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05,
    autovacuum_vacuum_threshold = 50,
    autovacuum_analyze_threshold = 50
);

ALTER TABLE oauth_refresh_tokens SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05,
    autovacuum_vacuum_threshold = 50,
    autovacuum_analyze_threshold = 50
);

ALTER TABLE oauth_audit_log SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02,
    autovacuum_vacuum_threshold = 100,
    autovacuum_analyze_threshold = 100
);

-- Increase statistics for frequently queried columns
ALTER TABLE oauth_authorization_codes ALTER COLUMN code SET STATISTICS 500;
ALTER TABLE oauth_authorization_codes ALTER COLUMN client_id SET STATISTICS 200;
ALTER TABLE oauth_authorization_codes ALTER COLUMN user_name SET STATISTICS 200;
ALTER TABLE oauth_access_tokens ALTER COLUMN token_hash SET STATISTICS 500;
ALTER TABLE oauth_access_tokens ALTER COLUMN client_id SET STATISTICS 200;
ALTER TABLE oauth_access_tokens ALTER COLUMN user_name SET STATISTICS 200;
ALTER TABLE oauth_refresh_tokens ALTER COLUMN token_hash SET STATISTICS 500;
ALTER TABLE oauth_refresh_tokens ALTER COLUMN client_id SET STATISTICS 200;

-- MCP Pending Auth Requests Table
-- Stores pending OAuth authorization requests for SSO flow (survives cross-domain redirects)
CREATE TABLE IF NOT EXISTS mcp_pending_auth_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_request_id VARCHAR(64) UNIQUE NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    code_challenge VARCHAR(255) NOT NULL,
    code_challenge_method VARCHAR(10) NOT NULL DEFAULT 'S256',
    redirect_uri TEXT NOT NULL,
    mcp_state VARCHAR(255),
    scopes JSONB,
    pac4j_state VARCHAR(64),
    pac4j_nonce VARCHAR(255),
    pac4j_code_verifier VARCHAR(255),
    expires_at BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mcp_pending_auth_request_id ON mcp_pending_auth_requests(auth_request_id);
CREATE INDEX IF NOT EXISTS idx_mcp_pending_auth_expires ON mcp_pending_auth_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_mcp_pending_auth_pac4j_state ON mcp_pending_auth_requests(pac4j_state);

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
