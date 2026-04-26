-- Issue #27158: tag_usage seq-scan on Postgres. #24063 dropped the
-- `state = 1` predicate that 1.11.0's partial indexes required.
-- Fix: add a single-col index, and drop the `WHERE state = 1` filter
-- from the existing partials so query changes can't invalidate them.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tag_usage_targetfqnhash_lower_pattern
ON tag_usage (targetfqnhash_lower text_pattern_ops);

DROP INDEX CONCURRENTLY IF EXISTS idx_tag_usage_target_prefix_covering;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tag_usage_target_prefix_covering
ON tag_usage (source, targetfqnhash_lower text_pattern_ops)
INCLUDE (tagFQN, labelType, state);

DROP INDEX CONCURRENTLY IF EXISTS idx_tag_usage_tagfqn_prefix_covering;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tag_usage_tagfqn_prefix_covering
ON tag_usage (source, tagfqn_lower text_pattern_ops)
INCLUDE (targetFQNHash, labelType, state);

DROP INDEX CONCURRENTLY IF EXISTS idx_tag_usage_join_source;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tag_usage_join_source
ON tag_usage (tagFQNHash, source)
INCLUDE (targetFQNHash, tagFQN, labelType, state);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
DROP INDEX CONCURRENTLY IF EXISTS gin_tag_usage_targetfqn_trgm;
CREATE INDEX CONCURRENTLY IF NOT EXISTS gin_tag_usage_targetfqn_trgm
ON tag_usage USING GIN (targetFQNHash gin_trgm_ops);
