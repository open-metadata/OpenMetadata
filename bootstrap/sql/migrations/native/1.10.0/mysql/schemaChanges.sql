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