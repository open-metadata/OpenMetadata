-- MCP OAuth 2.0 tables

CREATE TABLE IF NOT EXISTS oauth_clients (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    client_id VARCHAR(255) UNIQUE NOT NULL,
    client_secret_encrypted TEXT,
    client_name VARCHAR(255),
    redirect_uris JSON NOT NULL DEFAULT ('[]'),
    grant_types JSON NOT NULL DEFAULT ('["authorization_code", "refresh_token"]'),
    token_endpoint_auth_method VARCHAR(50) NOT NULL DEFAULT 'client_secret_post',
    scopes JSON NOT NULL DEFAULT ('["read", "write"]'),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT oauth_clients_client_id_check CHECK (CHAR_LENGTH(client_id) > 0),
    INDEX idx_oauth_clients_client_id (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    code VARCHAR(512) UNIQUE NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
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
    CONSTRAINT oauth_authorization_codes_challenge_method_check CHECK (
        code_challenge_method IS NULL OR code_challenge_method IN ('S256')
    ),
    INDEX idx_oauth_authz_codes_code (code),
    INDEX idx_oauth_authz_codes_client_id (client_id),
    INDEX idx_oauth_authz_codes_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS oauth_access_tokens (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    access_token_encrypted TEXT NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    scopes JSON NOT NULL DEFAULT ('[]'),
    expires_at BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT oauth_access_tokens_fk_client
        FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    CONSTRAINT oauth_access_tokens_expires_check CHECK (expires_at > 0),
    INDEX idx_oauth_access_tokens_hash (token_hash),
    INDEX idx_oauth_access_tokens_client_id (client_id),
    INDEX idx_oauth_access_tokens_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    refresh_token_encrypted TEXT NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    scopes JSON NOT NULL DEFAULT ('[]'),
    expires_at BIGINT NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT oauth_refresh_tokens_fk_client
        FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
    CONSTRAINT oauth_refresh_tokens_expires_check CHECK (expires_at > 0),
    INDEX idx_oauth_refresh_tokens_hash (token_hash),
    INDEX idx_oauth_refresh_tokens_client_id (client_id),
    INDEX idx_oauth_refresh_tokens_revoked (revoked),
    INDEX idx_oauth_refresh_tokens_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mcp_pending_auth_requests (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    auth_request_id VARCHAR(64) UNIQUE NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    code_challenge VARCHAR(255) NOT NULL,
    code_challenge_method VARCHAR(10) NOT NULL DEFAULT 'S256',
    redirect_uri TEXT NOT NULL,
    mcp_state VARCHAR(255),
    scopes JSON,
    pac4j_state VARCHAR(64),
    pac4j_nonce VARCHAR(255),
    pac4j_code_verifier VARCHAR(255),
    expires_at BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_mcp_pending_auth_request_id (auth_request_id),
    INDEX idx_mcp_pending_auth_expires (expires_at),
    INDEX idx_mcp_pending_auth_pac4j_state (pac4j_state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Incremental Search Retry Queue
-- Stores failed live-indexing operations for async background catch-up.
-- Keep this table intentionally minimal: entityId, entityFqn, failureReason, status.
CREATE TABLE IF NOT EXISTS search_index_retry_queue (
    entityId VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
    entityFqn VARCHAR(1024) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
    failureReason LONGTEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    entityType VARCHAR(256) NOT NULL DEFAULT '',
    retryCount INT NOT NULL DEFAULT 0,
    claimedAt TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (entityId, entityFqn),
    INDEX idx_search_index_retry_queue_status (status),
    INDEX idx_search_index_retry_queue_claimed (claimedAt)
);
