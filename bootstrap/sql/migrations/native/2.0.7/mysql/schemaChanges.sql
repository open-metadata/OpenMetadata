-- The MySQL half of idx_wf_instance_entity_link (the entityLinkHash VIRTUAL column and the index
-- over it) is added by the 2.0.7 Java migration (migration/utils/v207/MigrationUtil), not here: the runner
-- skips SQL statements it has already recorded on a retry, so a SET/PREPARE/EXECUTE guard whose
-- EXECUTE failed or was interrupted could never succeed again. The Java step checks
-- information_schema before each DDL and is rerun until it completes.
-- See ADR:2026-10-22-guarded-index-ddl-runs-from-a-java-data-migration.

-- The MySQL consent_token_hash and consent_user_name columns for MCP SSO consent are added by the
-- same Java migration, for the same reason. See ADR:2026-10-23-mcp-sso-asks-consent-after-the-idp-round-trip.

-- An FQN hash is one 32-char md5 per level joined by dots, so anything eight or more levels deep
-- (263+ chars) overflowed these varchar(256) columns: tasks on deep entities could not be created,
-- moving a glossary term with tasks to that depth failed, and eighth-level subdomains could not be
-- created. 768 is what the table and container FQN hash columns use. aboutFqnHash moves to ascii
-- like the other hash columns: at utf8mb4, 768 chars no longer fit idx_status_about in InnoDB's
-- 3072-byte key.
ALTER TABLE task_entity MODIFY COLUMN aboutFqnHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.aboutFqnHash'))) STORED;
ALTER TABLE domain_entity MODIFY COLUMN fqnHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;
