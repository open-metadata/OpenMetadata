-- SSO Test Login (#28784). A test spans several requests (start, the identity provider's callback,
-- the result polls, the credentials) that can reach different servers, so its state lives here
-- rather than in one server's memory. pending_state holds the candidate configuration with its
-- secrets, Fernet-encrypted, and is cleared when the test completes; rows expire minutes later.
CREATE TABLE IF NOT EXISTS sso_test_login_session (
    test_session_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    admin_principal VARCHAR(256) NOT NULL,
    protocol VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL,
    pending_state MEDIUMTEXT,
    result MEDIUMTEXT,
    credentials_submitted_at BIGINT,
    expires_at BIGINT NOT NULL,
    PRIMARY KEY (test_session_id),
    INDEX idx_sso_test_login_session_admin (admin_principal, credentials_submitted_at),
    INDEX idx_sso_test_login_session_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
