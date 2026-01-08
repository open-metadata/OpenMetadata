-- Register Claude Desktop as pre-configured OAuth client for MCP User SSO
-- This enables Claude Desktop to authenticate users via OpenMetadata SSO without manual client registration
INSERT INTO oauth_clients (client_id, client_name, redirect_uris, grant_types, scopes, created_at)
VALUES (
  'claude-desktop',
  'Claude Desktop',
  '["http://localhost:6274/callback", "http://127.0.0.1:6274/callback"]',
  '["authorization_code", "refresh_token"]',
  '["openid", "email", "profile", "read", "write", "offline_access"]',
  UNIX_TIMESTAMP()
) ON DUPLICATE KEY UPDATE
  client_name = VALUES(client_name),
  redirect_uris = VALUES(redirect_uris),
  grant_types = VALUES(grant_types),
  scopes = VALUES(scopes);
