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
