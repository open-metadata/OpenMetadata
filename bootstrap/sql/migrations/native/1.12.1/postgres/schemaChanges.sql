-- OAuth 2.0 Persistence Schema for MCP Server Integration
-- Version 1.12.1
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
