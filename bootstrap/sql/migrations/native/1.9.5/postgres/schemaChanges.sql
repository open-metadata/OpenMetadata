CREATE INDEX IF NOT EXISTS idx_tag_usage_target_fqn_hash ON tag_usage(targetFQNHash);
CREATE INDEX IF NOT EXISTS idx_tag_usage_tag_fqn_hash ON tag_usage(tagFQNHash);
CREATE INDEX IF NOT EXISTS idx_tag_usage_source_target ON tag_usage(source, targetFQNHash);
CREATE INDEX IF NOT EXISTS idx_tag_usage_target_source ON tag_usage(targetFQNHash, source, tagFQN);
CREATE INDEX IF NOT EXISTS idx_entity_relationship_from_relation ON entity_relationship(fromId, relation);
CREATE INDEX IF NOT EXISTS idx_entity_relationship_to_relation ON entity_relationship(toId, relation);
CREATE INDEX IF NOT EXISTS idx_entity_relationship_from_type_relation ON entity_relationship(fromId, fromEntity, relation);
CREATE INDEX IF NOT EXISTS idx_entity_relationship_to_type_relation ON entity_relationship(toId, toEntity, relation);

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

-- Update the relation between table and dataContract to 0 (CONTAINS)
UPDATE entity_relationship
SET relation = 0
WHERE fromEntity = 'table' AND toEntity = 'dataContract' AND relation = 10;
