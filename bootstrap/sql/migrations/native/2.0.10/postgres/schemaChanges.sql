-- SSO Test Login (#28784). A test spans several requests (start, the identity provider's callback,
-- the result polls, the credentials) that can reach different servers, so its state lives here
-- rather than in one server's memory. pending_state holds the candidate configuration with its
-- secrets, Fernet-encrypted, and is cleared when the test completes; rows expire minutes later.
CREATE TABLE IF NOT EXISTS sso_test_login_session (
    test_session_id VARCHAR(64) NOT NULL PRIMARY KEY,
    admin_principal VARCHAR(256) NOT NULL,
    protocol VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL,
    pending_state TEXT,
    result TEXT,
    credentials_submitted_at BIGINT,
    expires_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sso_test_login_session_admin
    ON sso_test_login_session (admin_principal, credentials_submitted_at);
CREATE INDEX IF NOT EXISTS idx_sso_test_login_session_expires
    ON sso_test_login_session (expires_at);
