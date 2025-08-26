-- Performance optimization indexes for entity_relationship and tag_usage tables
-- MySQL version for OpenMetadata 1.9.5
-- Focus: Optimize the N+1 query problem in setFieldsInternal

-- ========================================
-- Entity Relationship Performance Indexes
-- ========================================

ALTER TABLE tag_usage ADD INDEX idx_tag_usage_target_fqn_hash (targetFQNHash);
ALTER TABLE tag_usage ADD INDEX idx_tag_usage_tag_fqn_hash (tagFQNHash);
ALTER TABLE tag_usage ADD INDEX idx_tag_usage_source_target (source, targetFQNHash);
ALTER TABLE tag_usage ADD INDEX idx_tag_usage_target_source (targetFQNHash, source, tagFQN);
ALTER TABLE entity_relationship ADD INDEX idx_entity_relationship_from_relation (fromId, relation);
ALTER TABLE entity_relationship ADD INDEX idx_entity_relationship_to_relation (toId, relation);
ALTER TABLE entity_relationship ADD INDEX idx_entity_relationship_from_type_relation (fromId, fromEntity, relation);
ALTER TABLE entity_relationship ADD INDEX idx_entity_relationship_to_type_relation (toId, toEntity, relation);

ALTER TABLE table_entity ADD INDEX idx_table_entity_deleted (deleted);
ALTER TABLE database_entity ADD INDEX idx_database_entity_deleted (deleted);
ALTER TABLE database_schema_entity ADD INDEX idx_database_schema_entity_deleted (deleted);
ALTER TABLE pipeline_entity ADD INDEX idx_pipeline_entity_deleted (deleted);
ALTER TABLE chart_entity ADD INDEX idx_chart_entity_deleted (deleted);
ALTER TABLE dashboard_entity ADD INDEX idx_dashboard_entity_deleted (deleted);
ALTER TABLE topic_entity ADD INDEX idx_topic_entity_deleted (deleted);
ALTER TABLE ml_model_entity ADD INDEX idx_ml_model_entity_deleted (deleted);
ALTER TABLE glossary_entity ADD INDEX idx_glossary_entity_deleted (deleted);
ALTER TABLE glossary_term_entity ADD INDEX idx_glossary_term_entity_deleted (deleted);
ALTER TABLE user_entity ADD INDEX idx_user_entity_deleted (deleted);
ALTER TABLE team_entity ADD INDEX idx_team_entity_deleted (deleted);

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

-- ========================================
-- Table Storage Optimizations
-- ========================================
-- MySQL doesn't have PostgreSQL's autovacuum, but we can optimize with storage engine settings

-- Optimize entity_relationship table for frequent updates
-- Use DYNAMIC row format for better handling of variable-length columns
ALTER TABLE entity_relationship ROW_FORMAT=DYNAMIC;

-- Optimize change_event table (append-heavy)
-- Use DYNAMIC format (COMPRESSED can cause CPU overhead)
ALTER TABLE change_event ROW_FORMAT=DYNAMIC;

-- Optimize tag_usage table for frequent updates
ALTER TABLE tag_usage ROW_FORMAT=DYNAMIC;

-- Optimize field_relationship table
ALTER TABLE field_relationship ROW_FORMAT=DYNAMIC;

-- Update additional table statistics
ANALYZE TABLE change_event;
ANALYZE TABLE field_relationship;

-- Add table comments for documentation
ALTER TABLE entity_relationship COMMENT = 'High-frequency relationship table optimized with DYNAMIC row format and indexes for N+1 query prevention';
ALTER TABLE change_event COMMENT = 'Event log table optimized with DYNAMIC row format for append-heavy workload';
ALTER TABLE tag_usage COMMENT = 'Tag usage tracking optimized with DYNAMIC row format for frequent updates';
