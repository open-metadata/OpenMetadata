-- The MySQL half of idx_wf_instance_entity_link (the entityLinkHash VIRTUAL column and the index
-- over it) is added by the 2.0.7 Java migration (migration/utils/v207/MigrationUtil), not here: the runner
-- skips SQL statements it has already recorded on a retry, so a SET/PREPARE/EXECUTE guard whose
-- EXECUTE failed or was interrupted could never succeed again. The Java step checks
-- information_schema before each DDL and is rerun until it completes.
-- See ADR:2026-10-22-guarded-index-ddl-runs-from-a-java-data-migration.

-- The MySQL consent_token_hash and consent_user_name columns for MCP SSO consent are added by the
-- same Java migration, for the same reason. See ADR:2026-10-23-mcp-sso-asks-consent-after-the-idp-round-trip.
