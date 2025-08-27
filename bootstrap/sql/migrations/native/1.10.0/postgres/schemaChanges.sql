-- Performance optimization for tag_usage prefix queries (THE REAL FIX)
-- PostgreSQL version for OpenMetadata 1.10.0
-- Implements case-insensitive prefix search with massive performance gains

-- ========================================
-- STEP 1: Add Generated Column for Case-Insensitive Search
-- ========================================

-- Add lowercase columns for efficient case-insensitive searches
ALTER TABLE tag_usage 
ADD COLUMN IF NOT EXISTS targetfqnhash_lower text 
GENERATED ALWAYS AS (lower(targetFQNHash)) STORED;

ALTER TABLE tag_usage 
ADD COLUMN IF NOT EXISTS tagfqn_lower text 
GENERATED ALWAYS AS (lower(tagFQN)) STORED;

-- ========================================
-- STEP 2: Create Optimized Covering Indexes with text_pattern_ops
-- ========================================

-- Note: These may replace existing indexes from 1.9.3 that lack text_pattern_ops
-- Using IF NOT EXISTS to handle both new installations and upgrades
DROP INDEX IF EXISTS idx_tag_usage_target_composite;  -- This one exists from original 1.9.3

-- PRIMARY INDEX: For targetFQNHash prefix searches (LIKE 'prefix%')
-- This is the main culprit - needs text_pattern_ops for prefix matching
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tag_usage_target_prefix_covering
ON tag_usage (source, targetfqnhash_lower text_pattern_ops)
INCLUDE (tagFQN, labelType, state)
WHERE state = 1;  -- Only active tags

-- For exact match queries on targetFQNHash
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tag_usage_target_exact
ON tag_usage (source, targetFQNHash, state)
INCLUDE (tagFQN, labelType);

-- For tagFQN prefix searches if needed
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tag_usage_tagfqn_prefix_covering
ON tag_usage (source, tagfqn_lower text_pattern_ops)
INCLUDE (targetFQNHash, labelType, state)
WHERE state = 1;

-- For JOIN operations with classification and tag tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tag_usage_join_source
ON tag_usage (tagFQNHash, source)
INCLUDE (targetFQNHash, tagFQN, labelType, state)
WHERE state = 1;

-- Note: Indexes on classification and tag tables removed as they are not critical for the performance fix
-- The main performance issue is in tag_usage table which we've addressed above

-- ========================================
-- STEP 3: GIN Index for Contains Queries (if needed)
-- ========================================

-- Only create if you need %contains% searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index for substring matches (LIKE '%foo%')
CREATE INDEX CONCURRENTLY IF NOT EXISTS gin_tag_usage_targetfqn_trgm
ON tag_usage USING GIN (targetFQNHash gin_trgm_ops)
WHERE state = 1;

-- ========================================
-- STEP 4: Table Optimizations
-- ========================================

-- Optimize autovacuum for tag_usage (high update frequency)
ALTER TABLE tag_usage SET (
  autovacuum_vacuum_scale_factor = 0.05,    -- Vacuum at 5% dead rows (default 20%)
  autovacuum_analyze_scale_factor = 0.02,   -- Analyze at 2% changed rows (default 10%)
  autovacuum_vacuum_threshold = 50,         -- Minimum rows before vacuum
  autovacuum_analyze_threshold = 50,        -- Minimum rows before analyze
  fillfactor = 90                           -- Leave 10% free space for HOT updates
);

-- ========================================
-- STEP 5: Update Statistics and Analyze
-- ========================================

-- Increase statistics target for frequently queried columns
ALTER TABLE tag_usage ALTER COLUMN targetFQNHash SET STATISTICS 1000;
ALTER TABLE tag_usage ALTER COLUMN targetfqnhash_lower SET STATISTICS 1000;
ALTER TABLE tag_usage ALTER COLUMN tagFQN SET STATISTICS 500;
ALTER TABLE tag_usage ALTER COLUMN tagfqn_lower SET STATISTICS 500;
ALTER TABLE tag_usage ALTER COLUMN source SET STATISTICS 100;

-- Force immediate statistics update
VACUUM (ANALYZE) tag_usage;
ANALYZE classification;
ANALYZE tag;

-- ========================================
-- Fix for entity_relationship queries
-- ========================================

-- The queries filter on deleted = FALSE but current indexes don't include it
-- This causes slow queries as seen in AWS Performance Insights

-- These new indexes replace the basic ones with better filtering on deleted column
-- Using IF NOT EXISTS to handle both new installations and upgrades
DROP INDEX IF EXISTS idx_entity_relationship_from_composite;  -- May exist from original 1.9.3
DROP INDEX IF EXISTS idx_entity_relationship_to_composite;    -- May exist from original 1.9.3

-- Create new indexes with deleted column for efficient filtering
-- Using partial indexes (WHERE deleted = FALSE) for even better performance
CREATE INDEX IF NOT EXISTS idx_entity_relationship_from_deleted
ON entity_relationship(fromId, fromEntity, relation)
INCLUDE (toId, toEntity, json)
WHERE deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_entity_relationship_to_deleted
ON entity_relationship(toId, toEntity, relation)
INCLUDE (fromId, fromEntity, json)
WHERE deleted = FALSE;

-- Also add indexes for the specific queries that include fromEntity/toEntity filters
CREATE INDEX IF NOT EXISTS idx_entity_relationship_from_typed
ON entity_relationship(toId, toEntity, relation, fromEntity)
INCLUDE (fromId, json)
WHERE deleted = FALSE;

-- Index for bidirectional lookups (used in UNION queries)
CREATE INDEX IF NOT EXISTS idx_entity_relationship_bidirectional
ON entity_relationship(fromId, toId, relation)
WHERE deleted = FALSE;

-- Update statistics
ANALYZE entity_relationship;