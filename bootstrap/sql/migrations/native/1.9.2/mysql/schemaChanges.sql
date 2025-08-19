CREATE INDEX idx_tag_usage_target_fqn_hash ON tag_usage(targetFQNHash);
CREATE INDEX idx_tag_usage_tag_fqn_hash ON tag_usage(tagFQNHash);
CREATE INDEX idx_tag_usage_source_target ON tag_usage(source, targetFQNHash);
CREATE INDEX idx_tag_usage_target_source ON tag_usage(targetFQNHash, source, tagFQN);
CREATE INDEX idx_entity_relationship_from_relation ON entity_relationship(fromId, relation);
CREATE INDEX idx_entity_relationship_to_relation ON entity_relationship(toId, relation);
CREATE INDEX idx_entity_relationship_from_type_relation ON entity_relationship(fromId, fromEntity, relation);
CREATE INDEX idx_entity_relationship_to_type_relation ON entity_relationship(toId, toEntity, relation);

CREATE INDEX idx_table_entity_deleted ON table_entity(deleted);
CREATE INDEX idx_database_entity_deleted ON database_entity(deleted);
CREATE INDEX idx_database_schema_entity_deleted ON database_schema_entity(deleted);
CREATE INDEX idx_pipeline_entity_deleted ON pipeline_entity(deleted);
CREATE INDEX idx_chart_entity_deleted ON chart_entity(deleted);
CREATE INDEX idx_dashboard_entity_deleted ON dashboard_entity(deleted);
CREATE INDEX idx_topic_entity_deleted ON topic_entity(deleted);
CREATE INDEX idx_ml_model_entity_deleted ON ml_model_entity(deleted);
CREATE INDEX idx_glossary_entity_deleted ON glossary_entity(deleted);
CREATE INDEX idx_glossary_term_entity_deleted ON glossary_term_entity(deleted);
CREATE INDEX idx_user_entity_deleted ON user_entity(deleted);
CREATE INDEX idx_team_entity_deleted ON team_entity(deleted);

-- Performance optimization for tag_usage prefix queries
-- This addresses the 2-second latency issue in getTagsInternalByPrefix

-- Add FQN column to tag_usage for easier reverse lookups
-- This is needed for hybrid storage to update entity JSONs when tags are deleted/renamed
-- Note: We only add targetFQN since tagFQN already exists in the table
ALTER TABLE tag_usage ADD COLUMN targetFQN VARCHAR(768) COLLATE utf8mb4_bin;

-- Add targetFQNPrefix column for prefix-based queries
ALTER TABLE tag_usage ADD COLUMN targetFQNPrefix VARCHAR(16) GENERATED ALWAYS AS (LEFT(targetFQNHash, 16)) STORED;

-- Create covering index for prefix queries that includes all needed columns
-- This eliminates the need for table lookups during prefix queries
CREATE INDEX idx_tag_usage_prefix_covering ON tag_usage(targetFQNPrefix, targetFQNHash, source, tagFQN, labelType, state, tagFQNHash);

-- Create index on the new FQN column for performance
CREATE INDEX idx_tag_usage_target_fqn ON tag_usage(targetFQN);

-- Migrate existing data: We need to populate the FQN columns from existing entities
-- This is a one-time migration to backfill the FQN values
-- Note: This requires a separate migration script to populate from entity data