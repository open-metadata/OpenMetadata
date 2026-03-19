-- MCP OAuth 2.0 tables

CREATE TABLE IF NOT EXISTS oauth_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id VARCHAR(255) UNIQUE NOT NULL,
    client_secret_encrypted TEXT,
    client_name VARCHAR(255),
    redirect_uris JSONB NOT NULL DEFAULT '[]'::jsonb,
    grant_types JSONB NOT NULL DEFAULT '["authorization_code", "refresh_token"]'::jsonb,
    token_endpoint_auth_method VARCHAR(50) NOT NULL DEFAULT 'client_secret_post',
    scopes JSONB NOT NULL DEFAULT '["read", "write"]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT oauth_clients_client_id_check CHECK (char_length(client_id) > 0)
);

CREATE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON oauth_clients(client_id);

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
    CONSTRAINT oauth_authorization_codes_fk_client
        FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    CONSTRAINT oauth_authorization_codes_expires_check CHECK (expires_at > 0),
    CONSTRAINT oauth_authorization_codes_challenge_method_check CHECK (
        code_challenge_method IS NULL OR code_challenge_method IN ('S256')
    )
);

CREATE INDEX IF NOT EXISTS idx_oauth_authz_codes_code ON oauth_authorization_codes(code);
CREATE INDEX IF NOT EXISTS idx_oauth_authz_codes_client_id ON oauth_authorization_codes(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_authz_codes_expires_at ON oauth_authorization_codes(expires_at);

CREATE TABLE IF NOT EXISTS oauth_access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    access_token_encrypted TEXT NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
    expires_at BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT oauth_access_tokens_fk_client
        FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    CONSTRAINT oauth_access_tokens_expires_check CHECK (expires_at > 0)
);

CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_hash ON oauth_access_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_client_id ON oauth_access_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_expires_at ON oauth_access_tokens(expires_at);

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
    CONSTRAINT oauth_refresh_tokens_fk_client
        FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    CONSTRAINT oauth_refresh_tokens_expires_check CHECK (expires_at > 0)
);

CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_hash ON oauth_refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_client_id ON oauth_refresh_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_revoked ON oauth_refresh_tokens(revoked);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_expires_at ON oauth_refresh_tokens(expires_at);

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

-- Incremental Search Retry Queue
-- Stores failed live-indexing operations for async background catch-up.
-- Keep this table intentionally minimal: entityId, entityFqn, failureReason, status.
CREATE TABLE IF NOT EXISTS search_index_retry_queue (
    entityId VARCHAR(36) NOT NULL DEFAULT '',
    entityFqn VARCHAR(1024) NOT NULL DEFAULT '',
    failureReason TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    entityType VARCHAR(256) NOT NULL DEFAULT '',
    retryCount INT NOT NULL DEFAULT 0,
    claimedAt TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (entityId, entityFqn)
);

CREATE INDEX IF NOT EXISTS idx_search_index_retry_queue_status
ON search_index_retry_queue(status);

CREATE INDEX IF NOT EXISTS idx_search_index_retry_queue_claimed
ON search_index_retry_queue(claimedAt);
