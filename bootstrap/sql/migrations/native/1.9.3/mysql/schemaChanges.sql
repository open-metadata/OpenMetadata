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

-- Update the relation between table and dataContract to 0 (CONTAINS)
UPDATE entity_relationship
SET relation = 0
WHERE fromEntity = 'table' AND toEntity = 'dataContract' AND relation = 10;
