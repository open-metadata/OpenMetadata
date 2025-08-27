-- Performance optimization for tag_usage prefix queries
-- MySQL version for OpenMetadata 1.10.0
-- Implements case-insensitive prefix search with performance optimizations

-- ========================================
-- STEP 1: Add Generated Columns for Case-Insensitive Search
-- ========================================

-- MySQL 5.7+ supports generated columns for efficient case-insensitive searches
-- Separate ALTER statements for columns and indexes
-- IMPORTANT: Specify collation explicitly to avoid mismatch errors
-- The LOWER() function result must match the table's collation
ALTER TABLE tag_usage 
ADD COLUMN targetfqnhash_lower VARCHAR(768) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
GENERATED ALWAYS AS (CONVERT(LOWER(targetFQNHash) USING utf8mb4) COLLATE utf8mb4_unicode_ci) STORED;

ALTER TABLE tag_usage 
ADD COLUMN tagfqn_lower VARCHAR(768) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
GENERATED ALWAYS AS (CONVERT(LOWER(tagFQN) USING utf8mb4) COLLATE utf8mb4_unicode_ci) STORED;

-- Create indexes on the new columns
CREATE INDEX idx_targetfqnhash_lower ON tag_usage (targetfqnhash_lower(255));
CREATE INDEX idx_tagfqn_lower ON tag_usage (tagfqn_lower(255));

-- ========================================
-- STEP 2: Create Optimized Composite Indexes
-- ========================================

-- Note: No old indexes to drop as this is the first time these are being created

-- PRIMARY INDEX: For targetFQNHash prefix searches (LIKE 'prefix%')
-- Using prefix indexing for large VARCHAR columns to stay within MySQL's 3072 byte limit
CREATE INDEX idx_tag_usage_target_prefix_composite
ON tag_usage (source, targetfqnhash_lower(255), state, tagFQN(255), labelType);

-- For exact match queries
CREATE INDEX idx_tag_usage_target_exact_composite
ON tag_usage (source, targetFQNHash(255), state, tagFQN(255), labelType);

-- For tagFQN prefix searches
CREATE INDEX idx_tag_usage_tagfqn_prefix_composite
ON tag_usage (source, tagfqn_lower(255), state, targetFQNHash(255), labelType);

-- For JOIN operations
CREATE INDEX idx_tag_usage_join_composite
ON tag_usage (tagFQNHash(255), source, state, targetFQNHash(255), tagFQN(255), labelType);

-- Note: Indexes on classification and tag tables removed as they are not critical for the performance fix
-- The main performance issue is in tag_usage table which we've addressed above

-- ========================================
-- STEP 3: Add FULLTEXT Index for Contains Queries (if needed)
-- ========================================

-- Only if you need contains searches
-- Note: FULLTEXT indexes in MySQL work differently than PostgreSQL's pg_trgm
CREATE FULLTEXT INDEX ft_tag_usage_targetfqn 
ON tag_usage(targetFQNHash);

-- ========================================
-- STEP 4: Table Optimizations
-- ========================================

-- Optimize table for better performance
-- OPTIMIZE TABLE tag_usage;
-- OPTIMIZE TABLE classification;
-- OPTIMIZE TABLE tag;

-- Update table statistics
-- ANALYZE TABLE tag_usage;
-- ANALYZE TABLE classification;
-- ANALYZE TABLE tag;

-- ========================================
-- Fix for classification term count queries
-- ========================================

-- Add index for efficient bulk term count queries
-- The bulkGetTermCounts query uses: WHERE classificationHash IN (...) AND deleted = FALSE
CREATE INDEX idx_tag_classification_deleted 
ON tag (classificationHash, deleted);

-- ========================================
-- Fix for entity_relationship queries
-- ========================================

-- The queries filter on deleted = FALSE but current indexes don't include it
-- This causes slow queries as seen in AWS Performance Insights

-- Note: No old indexes to drop as this is the first time these optimized indexes are being created

-- Create new composite indexes with deleted column
-- MySQL doesn't support INCLUDE clause, so we put all columns in the index
CREATE INDEX idx_entity_relationship_from_deleted
ON entity_relationship(fromId, fromEntity, relation, deleted, toId, toEntity);

CREATE INDEX idx_entity_relationship_to_deleted
ON entity_relationship(toId, toEntity, relation, deleted, fromId, fromEntity);

-- Index for queries that filter by fromEntity/toEntity
CREATE INDEX idx_entity_relationship_from_typed
ON entity_relationship(toId, toEntity, relation, fromEntity, deleted, fromId);

-- Index for bidirectional lookups
CREATE INDEX idx_entity_relationship_bidirectional
ON entity_relationship(fromId, toId, relation, deleted);

-- Update statistics
-- ANALYZE TABLE entity_relationship;