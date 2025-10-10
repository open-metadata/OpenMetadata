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

-- Create credentials_entity table for centralized credential management
CREATE TABLE IF NOT EXISTS credentials_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.id'))) STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.name'))) VIRTUAL NOT NULL,
    fqnHash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.updatedAt'))) VIRTUAL NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.updatedBy'))) VIRTUAL NOT NULL,
    deleted TINYINT(1) GENERATED ALWAYS AS (json_extract(json, '$.deleted')) VIRTUAL,
    credentialType VARCHAR(50) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.credentialType'))) VIRTUAL NOT NULL,
    serviceTypes JSON GENERATED ALWAYS AS (json_extract(json, '$.serviceTypes')) VIRTUAL,
    isOAuth TINYINT(1) GENERATED ALWAYS AS (json_extract(json, '$.isOAuth')) VIRTUAL,
    requiresUserAuthentication TINYINT(1) GENERATED ALWAYS AS (json_extract(json, '$.requiresUserAuthentication')) VIRTUAL,

    PRIMARY KEY (id),
    UNIQUE KEY fqnHash (fqnHash),
    INDEX idx_credentials_name (name),
    INDEX idx_credentials_type (credentialType),
    INDEX idx_credentials_oauth (isOAuth),
    INDEX idx_credentials_user_auth (requiresUserAuthentication),
    INDEX idx_credentials_updated (updatedAt),
    INDEX idx_credentials_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Create oauth_token_entity table for per-user OAuth token management
CREATE TABLE IF NOT EXISTS oauth_token_entity (
    id VARCHAR(36) NOT NULL,
    userId VARCHAR(36) NOT NULL,
    credentialsId VARCHAR(36) NOT NULL,
    accessToken TEXT NOT NULL,
    refreshToken TEXT,
    tokenType VARCHAR(50) DEFAULT 'Bearer',
    expiresAt BIGINT UNSIGNED,
    scopes JSON,
    status VARCHAR(20) DEFAULT 'Active',
    lastRefreshedAt BIGINT UNSIGNED,
    refreshFailureCount INT DEFAULT 0,
    refreshFailureReason TEXT,
    createdAt BIGINT UNSIGNED NOT NULL,
    updatedAt BIGINT UNSIGNED NOT NULL,
    version DOUBLE DEFAULT 1.0,
    deleted TINYINT(1) DEFAULT FALSE,

    PRIMARY KEY (id),
    UNIQUE KEY unique_user_credential (userId, credentialsId),
    INDEX idx_token_user (userId),
    INDEX idx_token_credentials (credentialsId),
    INDEX idx_token_expiry (expiresAt),
    INDEX idx_token_status (status),
    INDEX idx_token_created (createdAt),
    FOREIGN KEY fk_oauth_token_user (userId) REFERENCES user_entity(id) ON DELETE CASCADE,
    FOREIGN KEY fk_oauth_token_credentials (credentialsId) REFERENCES credentials_entity(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
