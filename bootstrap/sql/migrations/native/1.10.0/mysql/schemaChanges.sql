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

-- Fetch updated searchSettings
DELETE FROM openmetadata_settings WHERE configType = 'searchSettings';

-- Create notification_template_entity table following OpenMetadata patterns
CREATE TABLE IF NOT EXISTS notification_template_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.id'))) STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.name'))) VIRTUAL NOT NULL,
    fqnHash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.updatedAt'))) VIRTUAL NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.updatedBy'))) VIRTUAL NOT NULL,
    deleted TINYINT(1) GENERATED ALWAYS AS (json_extract(json, '$.deleted')) VIRTUAL,
    provider VARCHAR(32) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.provider'))) VIRTUAL,

    PRIMARY KEY (id),
    UNIQUE KEY fqnHash (fqnHash),
    INDEX idx_notification_template_name (name),
    INDEX idx_notification_template_provider (provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Optimize table listing queries by indexing the schema hash prefix
ALTER TABLE table_entity
ADD COLUMN databaseSchemaHash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin
GENERATED ALWAYS AS (SUBSTRING_INDEX(fqnHash, '.', 3)) STORED;

CREATE INDEX idx_table_entity_schema_listing
ON table_entity (deleted, databaseSchemaHash, name, id);

-- Optimize stored procedure listing queries by indexing the schema hash prefix
ALTER TABLE stored_procedure_entity
ADD COLUMN databaseSchemaHash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin
GENERATED ALWAYS AS (SUBSTRING_INDEX(fqnHash, '.', 3)) STORED;


CREATE INDEX idx_stored_procedure_entity_deleted_name_id ON stored_procedure_entity(deleted, name, id);

ALTER TABLE stored_procedure_entity
DROP INDEX idx_stored_procedure_entity_deleted_name_id;

CREATE INDEX idx_stored_procedure_schema_listing
ON stored_procedure_entity (deleted, databaseSchemaHash, name, id);


-- Recognizer Feedback Storage
-- Store user feedback on auto-applied tags to improve recognition accuracy
CREATE TABLE IF NOT EXISTS recognizer_feedback_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.id'))) STORED NOT NULL,
    entityLink VARCHAR(512) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.entityLink'))) VIRTUAL NOT NULL,
    tagFQN VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.tagFQN'))) VIRTUAL NOT NULL,
    feedbackType VARCHAR(50) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.feedbackType'))) VIRTUAL NOT NULL,
    status VARCHAR(20) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.status'))) VIRTUAL,
    createdBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.createdBy'))) VIRTUAL NOT NULL,
    createdAt BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.createdAt'))) VIRTUAL NOT NULL,
    json JSON NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_feedback_entity (entityLink),
    INDEX idx_feedback_tag (tagFQN),
    INDEX idx_feedback_status (status),
    INDEX idx_feedback_created (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE tag_usage
ADD COLUMN reason TEXT;
