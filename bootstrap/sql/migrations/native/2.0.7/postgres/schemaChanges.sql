-- idx_wf_instance_entity_link (an expression index on md5(COALESCE(entityLink, '')),
-- workflowDefinitionId, timestamp) is built by the 2.0.7 Java migration (migration/utils/v207/MigrationUtil),
-- not here: it builds CONCURRENTLY and, unlike IF NOT EXISTS on its own, drops and rebuilds an
-- INVALID index left by an interrupted build, so a retried upgrade repairs itself.
-- See ADR:2026-10-22-guarded-index-ddl-runs-from-a-java-data-migration.

-- MCP SSO sign-in waits for the user to approve the client on a consent page. The pending
-- approval lives on the pending request row so it survives any server answering the POST.
-- ADR:2026-10-23-mcp-sso-asks-consent-after-the-idp-round-trip
ALTER TABLE mcp_pending_auth_requests
    ADD COLUMN IF NOT EXISTS consent_token_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS consent_user_name VARCHAR(256);
