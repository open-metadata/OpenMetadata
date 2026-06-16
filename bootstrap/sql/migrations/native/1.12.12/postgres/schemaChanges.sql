-- Widen tag_usage.tagFQN (was VARCHAR(256)) toward the fullyQualifiedEntityName contract (max 3072).
-- Entity names allow up to 256 chars and nested glossary terms concatenate, so a tag FQN routinely
-- exceeds 256 -- which made applyTag inserts and glossaryTerm moveAsync renames fail with
-- "value too long for type character varying(256)". tagFQN feeds the tagfqn_lower generated column,
-- which Postgres will not let us re-type in place, so drop it (cascading its two text_pattern_ops
-- indexes), widen tagFQN, then recreate the column and those indexes unchanged. 512 keeps the column
-- within MySQL InnoDB's 3072-byte key limit for the full-tagFQN idx_tag_usage_target_source index.
ALTER TABLE tag_usage DROP COLUMN IF EXISTS tagfqn_lower;
ALTER TABLE tag_usage ALTER COLUMN tagFQN TYPE VARCHAR(512);
ALTER TABLE tag_usage ADD COLUMN tagfqn_lower text GENERATED ALWAYS AS (lower(tagFQN)) STORED;
ALTER TABLE tag_usage ALTER COLUMN tagfqn_lower SET STATISTICS 500;
CREATE INDEX IF NOT EXISTS idx_tag_usage_tagfqn_lower_pattern
    ON tag_usage (tagfqn_lower text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_tag_usage_tagfqn_prefix_covering
    ON tag_usage (source, tagfqn_lower text_pattern_ops)
    INCLUDE (targetFQNHash, labelType, state);

-- PII recognizer context keyword cleanup: remove overly broad context keywords
-- (e.g. "code", "security", "address", "name", "call", "check", "save", "social")
-- that caused false-positive PII classification on non-PII columns.
-- Handled by Java data migration in v11212.MigrationUtil.removeBroadPiiContextKeywords.
