-- Performance optimization indexes for entity_relationship and tag_usage tables
-- PostgreSQL version for OpenMetadata 1.9.3
-- Focus: Optimize the N+1 query problem in setFieldsInternal

-- ========================================
-- Entity Relationship Performance Indexes
-- ========================================

-- Drop old indexes if they exist
DROP INDEX IF EXISTS idx_entity_relationship_from;
DROP INDEX IF EXISTS idx_entity_relationship_to;

-- Primary composite index for findFrom queries with covering columns
-- Used by: getOwners, getFollowers, getDomains, getDataProducts, getReviewers
CREATE INDEX IF NOT EXISTS idx_entity_relationship_from_composite
ON entity_relationship(fromId, fromEntity, relation) 
INCLUDE (toId, toEntity, json);

-- Primary composite index for findTo queries with covering columns
-- Used by: getChildren, getExperts, getParent
CREATE INDEX IF NOT EXISTS idx_entity_relationship_to_composite
ON entity_relationship(toId, toEntity, relation) 
INCLUDE (fromId, fromEntity, json);

-- Index for relation-specific queries (batch operations)
CREATE INDEX IF NOT EXISTS idx_entity_relationship_relation
ON entity_relationship(relation, fromEntity, toEntity);

-- Index for bidirectional relationship existence checks
CREATE INDEX IF NOT EXISTS idx_entity_relationship_bidirectional
ON entity_relationship(fromId, toId, relation);

-- Partial index for ownership queries (most common relationship type)
CREATE INDEX IF NOT EXISTS idx_entity_relationship_ownership
ON entity_relationship(toId, toEntity)
WHERE relation = 8 AND fromEntity IN ('user', 'team');

-- Partial index for lineage queries
CREATE INDEX IF NOT EXISTS idx_entity_relationship_lineage
ON entity_relationship(fromId, toId)
WHERE relation = 11;

-- ========================================
-- Tag Usage Performance Indexes
-- ========================================

-- Drop old indexes if they exist
DROP INDEX IF EXISTS idx_tag_usage_target;
DROP INDEX IF EXISTS idx_tag_usage_source;

-- Primary index for tag queries by target with covering columns
CREATE INDEX IF NOT EXISTS idx_tag_usage_target_composite
ON tag_usage(targetFQNHash)
INCLUDE (tagFQN, labelType, state, source)
WHERE state = 1; -- Only confirmed tags

-- Index for tag count queries
CREATE INDEX IF NOT EXISTS idx_tag_usage_tag_count
ON tag_usage(tagFQNHash, source)
WHERE state = 1;

-- Index for batch tag operations
CREATE INDEX IF NOT EXISTS idx_tag_usage_batch
ON tag_usage(targetFQNHash, source);

-- ========================================
-- Update Table Statistics
-- ========================================

-- Update statistics for better query planning
ANALYZE entity_relationship;
ANALYZE tag_usage;

-- Create extended statistics for correlated columns
CREATE STATISTICS IF NOT EXISTS stat_entity_relationship_from
(dependencies, ndistinct, mcv) 
ON fromId, fromEntity, relation 
FROM entity_relationship;

CREATE STATISTICS IF NOT EXISTS stat_entity_relationship_to
(dependencies, ndistinct, mcv)
ON toId, toEntity, relation 
FROM entity_relationship;

CREATE STATISTICS IF NOT EXISTS stat_tag_usage
(dependencies, ndistinct, mcv)
ON targetFQNHash, tagFQN, state 
FROM tag_usage;

-- ========================================
-- Table-Specific Autovacuum Optimizations
-- ========================================
-- These settings optimize autovacuum behavior and storage for frequently updated tables

-- Optimize entity_relationship table (high update frequency)
ALTER TABLE entity_relationship SET (
  autovacuum_vacuum_scale_factor = 0.1,     -- Vacuum when 10% of rows are dead (default 20%)
  autovacuum_analyze_scale_factor = 0.05,   -- Analyze when 5% of rows change (default 10%)
  autovacuum_vacuum_threshold = 500,        -- Minimum 500 rows before vacuum (prevents thrashing)
  autovacuum_analyze_threshold = 250,       -- Minimum 250 rows before analyze
  autovacuum_vacuum_cost_delay = 2,         -- 2ms delay between work (reduces I/O impact)
  autovacuum_vacuum_cost_limit = 200,       -- Cost limit before sleeping
  fillfactor = 90                           -- Leave 10% free space for HOT updates
);

-- Optimize change_event table (append-heavy with occasional updates)
ALTER TABLE change_event SET (
  autovacuum_enabled = true,
  autovacuum_vacuum_scale_factor = 0.1,     -- Less aggressive than entity_relationship
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 100,
  autovacuum_analyze_threshold = 50
);

-- Optimize tag_usage table (frequent updates)
ALTER TABLE tag_usage SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 200,
  autovacuum_analyze_threshold = 100,
  autovacuum_vacuum_cost_delay = 2,
  fillfactor = 90
);

-- Optimize field_relationship table (frequent updates)
ALTER TABLE field_relationship SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05,
  autovacuum_vacuum_threshold = 300,
  autovacuum_analyze_threshold = 150,
  autovacuum_vacuum_cost_delay = 2,
  fillfactor = 90
);

-- Add comments to track optimizations
COMMENT ON TABLE entity_relationship IS 'High-frequency relationship table with optimized autovacuum settings and indexes for N+1 query prevention';
COMMENT ON TABLE change_event IS 'Event log table with optimized autovacuum for append-heavy workload';
COMMENT ON TABLE tag_usage IS 'Tag usage tracking with aggressive autovacuum for frequent updates';