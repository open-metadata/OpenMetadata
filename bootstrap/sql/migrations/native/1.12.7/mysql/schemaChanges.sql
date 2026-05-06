-- Placeholder for 1.12.7 MySQL schema changes
-- The Postgres-side fix for #27158 has no MySQL counterpart: MySQL's
-- 1.11.0 indexes were already non-partial (no partial-index syntax in
-- MySQL), so the regression that hit Postgres did not affect MySQL.

-- MCP OAuth: state parameter is opaque per RFC 6749 §4.1.1 and some clients (notably the
-- Databricks MCP Proxy) send tokens longer than 255 characters. Widen mcp_state to TEXT to
-- avoid INSERT failures on /mcp/authorize redirects.
ALTER TABLE mcp_pending_auth_requests
    MODIFY COLUMN mcp_state TEXT;
