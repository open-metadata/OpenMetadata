-- OAuth 2.0 Persistence Schema for MCP Server Integration
-- Version 1.12.1
-- This migration adds tables to support OAuth 2.0 authorization flow for MCP server authentication

-- OAuth Clients Table
-- Stores registered OAuth 2.0 client applications
CREATE TABLE IF NOT EXISTS oauth_client (
    id VARCHAR(36) PRIMARY KEY,
    client_id VARCHAR(255) UNIQUE NOT NULL,
    client_secret_encrypted TEXT,
    client_name VARCHAR(255),
    redirect_uris JSON NOT NULL,
    grant_types JSON NOT NULL,
    token_endpoint_auth_method VARCHAR(50) NOT NULL DEFAULT 'client_secret_basic',
    scopes JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT oauth_clients_client_id_check CHECK (CHAR_LENGTH(client_id) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='OAuth 2.0 registered client applications';

CREATE INDEX idx_oauth_clients_client_id ON oauth_client(client_id);
CREATE INDEX idx_oauth_clients_created_at ON oauth_client(created_at);

-- OAuth Authorization Codes Table
-- Stores temporary authorization codes for authorization code flow
CREATE TABLE IF NOT EXISTS oauth_authorization_code (
    id VARCHAR(36) PRIMARY KEY,
    code_hash VARCHAR(255) UNIQUE NOT NULL,
    code_encrypted TEXT NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    connector_name VARCHAR(255) NOT NULL,
    code_challenge VARCHAR(255),
    code_challenge_method VARCHAR(10),
    redirect_uri TEXT NOT NULL,
    scopes JSON NOT NULL,
    expires_at BIGINT NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT oauth_authz_codes_fk_client FOREIGN KEY (client_id) REFERENCES oauth_client(client_id) ON DELETE CASCADE,
    CONSTRAINT oauth_authz_codes_expires_check CHECK (expires_at > 0),
    CONSTRAINT oauth_authz_codes_hash_check CHECK (CHAR_LENGTH(code_hash) > 0),
    CONSTRAINT oauth_authz_codes_connector_check CHECK (CHAR_LENGTH(connector_name) > 0),
    CONSTRAINT oauth_authz_codes_challenge_method_check CHECK (
        code_challenge_method IS NULL OR
        code_challenge_method IN ('plain', 'S256')
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Temporary authorization codes for OAuth 2.0 authorization code flow';

CREATE INDEX idx_oauth_authz_codes_hash ON oauth_authorization_code(code_hash);
CREATE INDEX idx_oauth_authz_codes_client_id ON oauth_authorization_code(client_id);
CREATE INDEX idx_oauth_authz_codes_connector ON oauth_authorization_code(connector_name);
CREATE INDEX idx_oauth_authz_codes_expires_at ON oauth_authorization_code(expires_at);
CREATE INDEX idx_oauth_authz_codes_created_at ON oauth_authorization_code(created_at);

-- OAuth Access Tokens Table
-- Stores active access tokens for API authentication
CREATE TABLE IF NOT EXISTS oauth_access_token (
    id VARCHAR(36) PRIMARY KEY,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    access_token_encrypted TEXT NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    connector_name VARCHAR(255) NOT NULL,
    user_name VARCHAR(255),
    scopes JSON NOT NULL,
    expires_at BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT oauth_access_tokens_fk_client FOREIGN KEY (client_id) REFERENCES oauth_client(client_id) ON DELETE CASCADE,
    CONSTRAINT oauth_access_tokens_expires_check CHECK (expires_at > 0),
    CONSTRAINT oauth_access_tokens_hash_check CHECK (CHAR_LENGTH(token_hash) > 0),
    CONSTRAINT oauth_access_tokens_connector_check CHECK (CHAR_LENGTH(connector_name) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Active OAuth 2.0 access tokens for API authentication';

CREATE INDEX idx_oauth_access_tokens_hash ON oauth_access_token(token_hash);
CREATE INDEX idx_oauth_access_tokens_client_id ON oauth_access_token(client_id);
CREATE INDEX idx_oauth_access_tokens_connector ON oauth_access_token(connector_name);
CREATE INDEX idx_oauth_access_tokens_user ON oauth_access_token(user_name);
CREATE INDEX idx_oauth_access_tokens_expires_at ON oauth_access_token(expires_at);
CREATE INDEX idx_oauth_access_tokens_created_at ON oauth_access_token(created_at);

-- OAuth Refresh Tokens Table
-- Stores refresh tokens for obtaining new access tokens
CREATE TABLE IF NOT EXISTS oauth_refresh_token (
    id VARCHAR(36) PRIMARY KEY,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    refresh_token_encrypted TEXT NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    connector_name VARCHAR(255) NOT NULL,
    user_name VARCHAR(255),
    scopes JSON NOT NULL,
    expires_at BIGINT NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT oauth_refresh_tokens_fk_client FOREIGN KEY (client_id) REFERENCES oauth_client(client_id) ON DELETE CASCADE,
    CONSTRAINT oauth_refresh_tokens_expires_check CHECK (expires_at > 0),
    CONSTRAINT oauth_refresh_tokens_hash_check CHECK (CHAR_LENGTH(token_hash) > 0),
    CONSTRAINT oauth_refresh_tokens_connector_check CHECK (CHAR_LENGTH(connector_name) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='OAuth 2.0 refresh tokens for obtaining new access tokens';

CREATE INDEX idx_oauth_refresh_tokens_hash ON oauth_refresh_token(token_hash);
CREATE INDEX idx_oauth_refresh_tokens_client_id ON oauth_refresh_token(client_id);
CREATE INDEX idx_oauth_refresh_tokens_connector ON oauth_refresh_token(connector_name);
CREATE INDEX idx_oauth_refresh_tokens_user ON oauth_refresh_token(user_name);
CREATE INDEX idx_oauth_refresh_tokens_revoked ON oauth_refresh_token(revoked);
CREATE INDEX idx_oauth_refresh_tokens_expires_at ON oauth_refresh_token(expires_at);
CREATE INDEX idx_oauth_refresh_tokens_created_at ON oauth_refresh_token(created_at);
