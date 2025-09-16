-- Performance optimization for tag_usage prefix queries
ALTER TABLE tag_usage
ADD COLUMN targetfqnhash_lower VARCHAR(768) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
GENERATED ALWAYS AS (CONVERT(LOWER(targetFQNHash) USING utf8mb4) COLLATE utf8mb4_unicode_ci) STORED;

ALTER TABLE tag_usage
ADD COLUMN tagfqn_lower VARCHAR(768) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
GENERATED ALWAYS AS (CONVERT(LOWER(tagFQN) USING utf8mb4) COLLATE utf8mb4_unicode_ci) STORED;

-- Create indexes on the new columns
CREATE INDEX idx_targetfqnhash_lower ON tag_usage (targetfqnhash_lower(255));
CREATE INDEX idx_tagfqn_lower ON tag_usage (tagfqn_lower(255));

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

CREATE FULLTEXT INDEX ft_tag_usage_targetfqn
ON tag_usage(targetFQNHash);

-- Add index for efficient bulk term count queries
-- The bulkGetTermCounts query uses: WHERE classificationHash IN (...) AND deleted = FALSE
CREATE INDEX idx_tag_classification_deleted
ON tag (classificationHash, deleted);

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


-- Add "Data Product Domain Validation" rule to existing entityRulesSettings configuration
UPDATE openmetadata_settings
SET json = JSON_ARRAY_APPEND(
    json,
    '$.entitySemantics',
    JSON_OBJECT(
        'name', 'Data Product Domain Validation',
        'description', 'Validates that Data Products assigned to an entity match the entity''s domains.',
        'rule', '{"validateDataProductDomainMatch":[{"var":"dataProducts"},{"var":"domains"}]}',
        'enabled', true,
        'provider', 'system'
    )
)
WHERE configType = 'entityRulesSettings'
  AND JSON_EXTRACT(json, '$.entitySemantics') IS NOT NULL
  AND NOT JSON_CONTAINS(
    JSON_EXTRACT(json, '$.entitySemantics[*].name'),
    JSON_QUOTE('Data Product Domain Validation')
  );

-- Add virtual column for customUnitOfMeasurement
ALTER TABLE metric_entity
ADD COLUMN customUnitOfMeasurement VARCHAR(256)
GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.customUnitOfMeasurement'))) VIRTUAL;
-- Add index on the virtual column
CREATE INDEX idx_metric_custom_unit ON metric_entity(customUnitOfMeasurement);