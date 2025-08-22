-- Performance optimization indexes for entity_relationship and tag_usage tables
-- MySQL version for OpenMetadata 1.9.3
-- Focus: Optimize the N+1 query problem in setFieldsInternal

-- ========================================
-- Entity Relationship Performance Indexes
-- ========================================

-- Primary composite index for findFrom queries (most frequent pattern)
-- Used by: getOwners, getFollowers, getDomains, getDataProducts, getReviewers
CREATE INDEX idx_entity_relationship_from_composite
ON entity_relationship(fromId, fromEntity, relation, toId, toEntity);

-- Primary composite index for findTo queries
-- Used by: getChildren, getExperts, getParent
CREATE INDEX idx_entity_relationship_to_composite
ON entity_relationship(toId, toEntity, relation, fromId, fromEntity);

-- Index for relation-specific queries (batch operations)
CREATE INDEX idx_entity_relationship_relation
ON entity_relationship(relation, fromEntity, toEntity);

-- Index for bidirectional relationship existence checks
CREATE INDEX idx_entity_relationship_bidirectional
ON entity_relationship(fromId, toId, relation);

-- ========================================
-- Tag Usage Performance Indexes
-- ========================================

-- Primary index for tag queries by target
CREATE INDEX idx_tag_usage_target_composite
ON tag_usage(targetFQNHash, tagFQN, labelType, state, source);

-- Index for tag count queries
CREATE INDEX idx_tag_usage_tag_count
ON tag_usage(tagFQNHash, source, state);

-- Index for batch tag operations
CREATE INDEX idx_tag_usage_batch
ON tag_usage(targetFQNHash, source);

-- ========================================
-- Update Table Statistics
-- ========================================

-- Update statistics for better query planning
ANALYZE TABLE entity_relationship;
ANALYZE TABLE tag_usage;