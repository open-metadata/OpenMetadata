-- Widen tag_usage.tagFQN (was VARCHAR(256)) toward the fullyQualifiedEntityName contract (max 3072).
-- Entity names allow up to 256 chars and nested glossary terms concatenate, so a tag FQN routinely
-- exceeds 256 -- which made applyTag inserts and glossaryTerm moveAsync renames fail with
-- "value too long". MySQL widens the base column in place (the tagfqn_lower STORED generated column
-- and the tagFQN(255)-prefix indexes are unaffected). 512 keeps the full-tagFQN
-- idx_tag_usage_target_source within InnoDB's 3072-byte key limit (768 + 1 + 512*4 = 2817 bytes).
ALTER TABLE tag_usage MODIFY tagFQN VARCHAR(512) NOT NULL;

-- PII recognizer context keyword cleanup: remove overly broad context keywords
-- (e.g. "code", "security", "address", "name", "call", "check", "save", "social")
-- that caused false-positive PII classification on non-PII columns.
-- Handled by Java data migration in v11212.MigrationUtil.removeBroadPiiContextKeywords.
