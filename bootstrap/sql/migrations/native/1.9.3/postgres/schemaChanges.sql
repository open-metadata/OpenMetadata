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