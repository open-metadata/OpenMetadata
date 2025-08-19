-- Performance optimization indexes for PATCH operations
-- These indexes significantly improve the performance of tag-related queries and entity relationships

-- Critical index for tag_usage targetFQNHash LIKE queries
-- This index dramatically improves the getTagsInternalByPrefix query performance (2010ms -> <100ms)
CREATE INDEX IF NOT EXISTS idx_tag_usage_target_fqn_hash ON tag_usage(targetFQNHash);

-- Index for tag_usage tagFQNHash joins with glossary_term_entity and tag tables
CREATE INDEX IF NOT EXISTS idx_tag_usage_tag_fqn_hash ON tag_usage(tagFQNHash);

-- Composite index for source + targetFQNHash filtering
-- Optimizes queries that filter by source type and target pattern
CREATE INDEX IF NOT EXISTS idx_tag_usage_source_target ON tag_usage(source, targetFQNHash);

-- Composite index for tag_usage to optimize getTags queries
CREATE INDEX IF NOT EXISTS idx_tag_usage_target_source ON tag_usage(targetFQNHash, source, tagFQN);

-- Optimize entity_relationship queries for finding related entities
CREATE INDEX IF NOT EXISTS idx_entity_relationship_from_relation ON entity_relationship(fromId, relation);
CREATE INDEX IF NOT EXISTS idx_entity_relationship_to_relation ON entity_relationship(toId, relation);

-- Composite index for entity_relationship queries with entity type filtering
CREATE INDEX IF NOT EXISTS idx_entity_relationship_from_type_relation ON entity_relationship(fromId, fromEntity, relation);
CREATE INDEX IF NOT EXISTS idx_entity_relationship_to_type_relation ON entity_relationship(toId, toEntity, relation);

-- Indexes for entity tables to optimize count queries with deleted filter
-- These indexes improve listCount operations across all entity types
-- Only create for the most commonly queried entities to start
CREATE INDEX IF NOT EXISTS idx_table_entity_deleted ON table_entity(deleted);
CREATE INDEX IF NOT EXISTS idx_database_entity_deleted ON database_entity(deleted);
CREATE INDEX IF NOT EXISTS idx_database_schema_entity_deleted ON database_schema_entity(deleted);
CREATE INDEX IF NOT EXISTS idx_pipeline_entity_deleted ON pipeline_entity(deleted);
CREATE INDEX IF NOT EXISTS idx_chart_entity_deleted ON chart_entity(deleted);
CREATE INDEX IF NOT EXISTS idx_dashboard_entity_deleted ON dashboard_entity(deleted);
CREATE INDEX IF NOT EXISTS idx_topic_entity_deleted ON topic_entity(deleted);
CREATE INDEX IF NOT EXISTS idx_ml_model_entity_deleted ON ml_model_entity(deleted);
CREATE INDEX IF NOT EXISTS idx_glossary_entity_deleted ON glossary_entity(deleted);
CREATE INDEX IF NOT EXISTS idx_glossary_term_entity_deleted ON glossary_term_entity(deleted);
CREATE INDEX IF NOT EXISTS idx_user_entity_deleted ON user_entity(deleted);
CREATE INDEX IF NOT EXISTS idx_team_entity_deleted ON team_entity(deleted);