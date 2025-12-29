-- OAuth 2.0 Persistence Schema for MCP Server Integration (MySQL)
-- Version 1.12.1
-- This migration adds tables to support OAuth 2.0 authorization flow for MCP server authentication

-- OAuth Clients Table
-- Stores registered OAuth 2.0 client applications
CREATE TABLE IF NOT EXISTS oauth_clients (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    client_id VARCHAR(255) UNIQUE NOT NULL,
    client_secret_encrypted TEXT,
    client_name VARCHAR(255),
    redirect_uris JSON NOT NULL DEFAULT ('[]'),
    grant_types JSON NOT NULL DEFAULT ('["authorization_code", "refresh_token"]'),
    token_endpoint_auth_method VARCHAR(50) NOT NULL DEFAULT 'client_secret_basic',
    scopes JSON NOT NULL DEFAULT ('["read", "write"]'),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT oauth_clients_client_id_check CHECK (CHAR_LENGTH(client_id) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_oauth_clients_client_id ON oauth_clients(client_id);
CREATE INDEX idx_oauth_clients_created_at ON oauth_clients(created_at);

-- OAuth Authorization Codes Table
-- Stores temporary authorization codes for authorization code flow
CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    code VARCHAR(512) UNIQUE NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    connector_name VARCHAR(255) NOT NULL,
    user_name VARCHAR(255),
    code_challenge VARCHAR(255),
    code_challenge_method VARCHAR(10),
    redirect_uri TEXT NOT NULL,
    scopes JSON NOT NULL DEFAULT ('[]'),
    expires_at BIGINT NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT oauth_authorization_codes_fk_client
        FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    CONSTRAINT oauth_authorization_codes_expires_check CHECK (expires_at > 0),
    CONSTRAINT oauth_authorization_codes_code_check CHECK (CHAR_LENGTH(code) > 0),
    CONSTRAINT oauth_authorization_codes_connector_check CHECK (CHAR_LENGTH(connector_name) > 0),
    CONSTRAINT oauth_authorization_codes_challenge_method_check CHECK (
        code_challenge_method IS NULL OR
        code_challenge_method IN ('plain', 'S256')
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_oauth_authz_codes_code ON oauth_authorization_codes(code);
CREATE INDEX idx_oauth_authz_codes_client_id ON oauth_authorization_codes(client_id);
CREATE INDEX idx_oauth_authz_codes_connector ON oauth_authorization_codes(connector_name);
CREATE INDEX idx_oauth_authz_codes_user ON oauth_authorization_codes(user_name);
CREATE INDEX idx_oauth_authz_codes_expires_at ON oauth_authorization_codes(expires_at);
CREATE INDEX idx_oauth_authz_codes_created_at ON oauth_authorization_codes(created_at);

-- OAuth Access Tokens Table
-- Stores active access tokens for API authentication
CREATE TABLE IF NOT EXISTS oauth_access_tokens (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    access_token_encrypted TEXT NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    connector_name VARCHAR(255) NOT NULL,
    user_name VARCHAR(255),
    scopes JSON NOT NULL DEFAULT ('[]'),
    expires_at BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT oauth_access_tokens_fk_client
        FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    CONSTRAINT oauth_access_tokens_expires_check CHECK (expires_at > 0),
    CONSTRAINT oauth_access_tokens_hash_check CHECK (CHAR_LENGTH(token_hash) > 0),
    CONSTRAINT oauth_access_tokens_connector_check CHECK (CHAR_LENGTH(connector_name) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_oauth_access_tokens_hash ON oauth_access_tokens(token_hash);
CREATE INDEX idx_oauth_access_tokens_client_id ON oauth_access_tokens(client_id);
CREATE INDEX idx_oauth_access_tokens_connector ON oauth_access_tokens(connector_name);
CREATE INDEX idx_oauth_access_tokens_user ON oauth_access_tokens(user_name);
CREATE INDEX idx_oauth_access_tokens_expires_at ON oauth_access_tokens(expires_at);
CREATE INDEX idx_oauth_access_tokens_created_at ON oauth_access_tokens(created_at);

-- OAuth Refresh Tokens Table
-- Stores refresh tokens for obtaining new access tokens
CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    refresh_token_encrypted TEXT NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    connector_name VARCHAR(255) NOT NULL,
    user_name VARCHAR(255),
    scopes JSON NOT NULL DEFAULT ('[]'),
    expires_at BIGINT NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT oauth_refresh_tokens_fk_client
        FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    CONSTRAINT oauth_refresh_tokens_expires_check CHECK (expires_at > 0),
    CONSTRAINT oauth_refresh_tokens_hash_check CHECK (CHAR_LENGTH(token_hash) > 0),
    CONSTRAINT oauth_refresh_tokens_connector_check CHECK (CHAR_LENGTH(connector_name) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_oauth_refresh_tokens_hash ON oauth_refresh_tokens(token_hash);
CREATE INDEX idx_oauth_refresh_tokens_client_id ON oauth_refresh_tokens(client_id);
CREATE INDEX idx_oauth_refresh_tokens_connector ON oauth_refresh_tokens(connector_name);
CREATE INDEX idx_oauth_refresh_tokens_user ON oauth_refresh_tokens(user_name);
CREATE INDEX idx_oauth_refresh_tokens_revoked ON oauth_refresh_tokens(revoked);
CREATE INDEX idx_oauth_refresh_tokens_expires_at ON oauth_refresh_tokens(expires_at);
CREATE INDEX idx_oauth_refresh_tokens_created_at ON oauth_refresh_tokens(created_at);

-- OAuth Token Mappings Table
-- Maps MCP tokens to OAuth access tokens for integration
CREATE TABLE IF NOT EXISTS oauth_token_mappings (
    mcp_token_hash VARCHAR(255) PRIMARY KEY,
    access_token_id CHAR(36) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT oauth_token_mappings_fk_access_token
        FOREIGN KEY (access_token_id) REFERENCES oauth_access_tokens(id) ON DELETE CASCADE,
    CONSTRAINT oauth_token_mappings_hash_check CHECK (CHAR_LENGTH(mcp_token_hash) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_oauth_token_mappings_access_token ON oauth_token_mappings(access_token_id);
CREATE INDEX idx_oauth_token_mappings_created_at ON oauth_token_mappings(created_at);

-- OAuth Audit Log Table
-- Tracks all OAuth-related events for security and compliance
CREATE TABLE IF NOT EXISTS oauth_audit_log (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    event_type VARCHAR(50) NOT NULL,
    client_id VARCHAR(255),
    connector_name VARCHAR(255),
    user_name VARCHAR(255),
    success BOOLEAN NOT NULL,
    error_message TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSON DEFAULT ('{}'),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_oauth_audit_log_event_type ON oauth_audit_log(event_type);
CREATE INDEX idx_oauth_audit_log_client_id ON oauth_audit_log(client_id);
CREATE INDEX idx_oauth_audit_log_connector ON oauth_audit_log(connector_name);
CREATE INDEX idx_oauth_audit_log_user ON oauth_audit_log(user_name);
CREATE INDEX idx_oauth_audit_log_success ON oauth_audit_log(success);
CREATE INDEX idx_oauth_audit_log_created_at ON oauth_audit_log(created_at DESC);
CREATE INDEX idx_oauth_audit_log_ip_address ON oauth_audit_log(ip_address);
