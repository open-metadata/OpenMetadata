-- Register Claude Desktop as pre-configured OAuth client for MCP User SSO
-- This enables Claude Desktop to authenticate users via OpenMetadata SSO without manual client registration
INSERT INTO oauth_clients (client_id, client_name, redirect_uris, grant_types, scopes, created_at)
VALUES (
  'claude-desktop',
  'Claude Desktop',
  '["http://localhost:6274/callback", "http://127.0.0.1:6274/callback"]'::jsonb,
  '["authorization_code", "refresh_token"]'::jsonb,
  '["openid", "email", "profile", "read", "write", "offline_access"]'::jsonb,
  CURRENT_TIMESTAMP
) ON CONFLICT (client_id) DO UPDATE SET
  client_name = EXCLUDED.client_name,
  redirect_uris = EXCLUDED.redirect_uris,
  grant_types = EXCLUDED.grant_types,
  scopes = EXCLUDED.scopes;

-- Set authType to 'basic' for existing Snowflake connections that don't have it
-- This ensures backward compatibility after adding OAuth support to Snowflake connector
UPDATE database_service
SET json = jsonb_set(json, '{connection,config,authType}', '"basic"'::jsonb, true)
WHERE serviceType = 'Snowflake'
  AND json->'connection'->'config'->>'authType' IS NULL;
