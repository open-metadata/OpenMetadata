-- Add "Data Product Domain Validation" rule to existing entityRulesSettings configuration
UPDATE openmetadata_settings
SET json = jsonb_set(
    json,
    '{entitySemantics}',
    (json->'entitySemantics') || jsonb_build_object(
        'name', 'Data Product Domain Validation',
        'description', 'Validates that Data Products assigned to an entity match the entity''s domains.',
        'rule', '{"validateDataProductDomainMatch":[{"var":"dataProducts"},{"var":"domains"}]}',
        'enabled', true,
        'provider', 'system'
    )::jsonb,
    true
)
WHERE configtype = 'entityRulesSettings'
  AND json->'entitySemantics' IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(json->'entitySemantics') AS rule
    WHERE rule->>'name' = 'Data Product Domain Validation'
  );

-- Add generated column for customUnitOfMeasurement
ALTER TABLE metric_entity
ADD COLUMN customUnitOfMeasurement VARCHAR(256)
GENERATED ALWAYS AS ((json->>'customUnitOfMeasurement')::VARCHAR(256)) STORED;
-- Add index on the column
CREATE INDEX idx_metric_custom_unit ON metric_entity(customUnitOfMeasurement);

-- Fetch updated searchSettings
DELETE FROM openmetadata_settings WHERE configType = 'searchSettings';

-- Create notification_template_entity table following OpenMetadata patterns
CREATE TABLE IF NOT EXISTS notification_template_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    provider VARCHAR(32) GENERATED ALWAYS AS (json ->> 'provider') STORED,

    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

CREATE INDEX IF NOT EXISTS idx_notification_template_name ON notification_template_entity(name);
CREATE INDEX IF NOT EXISTS idx_notification_template_provider ON notification_template_entity(provider);

-- Optimize table listing queries by indexing the schema hash prefix
ALTER TABLE table_entity
ADD COLUMN IF NOT EXISTS databaseSchemaHash VARCHAR(768)
GENERATED ALWAYS AS (
  rtrim(
    split_part(fqnhash, '.', 1) || '.' ||
    split_part(fqnhash, '.', 2) || '.' ||
    split_part(fqnhash, '.', 3),
    '.'
  )
) STORED;

CREATE INDEX IF NOT EXISTS idx_table_entity_schema_listing
ON table_entity (deleted, databaseSchemaHash, name, id);

-- Optimize stored procedure listing queries by indexing the schema hash prefix
ALTER TABLE stored_procedure_entity
ADD COLUMN IF NOT EXISTS databaseSchemaHash VARCHAR(768)
GENERATED ALWAYS AS (
  rtrim(
    split_part(fqnhash, '.', 1) || '.' ||
    split_part(fqnhash, '.', 2) || '.' ||
    split_part(fqnhash, '.', 3),
    '.'
  )
) STORED;

DROP INDEX IF EXISTS idx_stored_procedure_entity_deleted_name_id;

CREATE INDEX IF NOT EXISTS idx_stored_procedure_schema_listing
ON stored_procedure_entity (deleted, databaseSchemaHash, name, id);


-- Recognizer Feedback Storage
-- Store user feedback on auto-applied tags to improve recognition accuracy
CREATE TABLE IF NOT EXISTS recognizer_feedback_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    entityLink VARCHAR(512) GENERATED ALWAYS AS (json ->> 'entityLink') STORED NOT NULL,
    tagFQN VARCHAR(256) GENERATED ALWAYS AS (json ->> 'tagFQN') STORED NOT NULL,
    feedbackType VARCHAR(50) GENERATED ALWAYS AS (json ->> 'feedbackType') STORED NOT NULL,
    status VARCHAR(20) GENERATED ALWAYS AS (json ->> 'status') STORED,
    createdBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'createdBy') STORED NOT NULL,
    createdAt BIGINT GENERATED ALWAYS AS ((json ->> 'createdAt')::bigint) STORED NOT NULL,
    json JSONB NOT NULL,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_entity ON recognizer_feedback_entity(entityLink);
CREATE INDEX IF NOT EXISTS idx_feedback_tag ON recognizer_feedback_entity(tagFQN);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON recognizer_feedback_entity(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON recognizer_feedback_entity(createdAt);

ALTER TABLE tag_usage
ADD COLUMN reason TEXT;

-- Create credentials_entity table for centralized credential management
CREATE TABLE IF NOT EXISTS credentials_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    credentialType VARCHAR(50) GENERATED ALWAYS AS (json ->> 'credentialType') STORED NOT NULL,
    serviceTypes JSONB GENERATED ALWAYS AS (json -> 'serviceTypes') STORED,
    isOAuth BOOLEAN GENERATED ALWAYS AS ((json ->> 'isOAuth')::boolean) STORED,
    requiresUserAuthentication BOOLEAN GENERATED ALWAYS AS ((json ->> 'requiresUserAuthentication')::boolean) STORED,

    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

CREATE INDEX IF NOT EXISTS idx_credentials_name ON credentials_entity(name);
CREATE INDEX IF NOT EXISTS idx_credentials_type ON credentials_entity(credentialType);
CREATE INDEX IF NOT EXISTS idx_credentials_oauth ON credentials_entity(isOAuth);
CREATE INDEX IF NOT EXISTS idx_credentials_user_auth ON credentials_entity(requiresUserAuthentication);
CREATE INDEX IF NOT EXISTS idx_credentials_updated ON credentials_entity(updatedAt);
CREATE INDEX IF NOT EXISTS idx_credentials_deleted ON credentials_entity(deleted);

-- Create oauth_token_entity table for per-user OAuth token management
CREATE TABLE IF NOT EXISTS oauth_token_entity (
    id VARCHAR(36) NOT NULL,
    userId VARCHAR(36) NOT NULL,
    credentialsId VARCHAR(36) NOT NULL,
    accessToken TEXT NOT NULL,
    refreshToken TEXT,
    tokenType VARCHAR(50) DEFAULT 'Bearer',
    expiresAt BIGINT,
    scopes JSONB,
    status VARCHAR(20) DEFAULT 'Active',
    lastRefreshedAt BIGINT,
    refreshFailureCount INTEGER DEFAULT 0,
    refreshFailureReason TEXT,
    createdAt BIGINT NOT NULL,
    updatedAt BIGINT NOT NULL,
    version DOUBLE PRECISION DEFAULT 1.0,
    deleted BOOLEAN DEFAULT FALSE,

    PRIMARY KEY (id),
    UNIQUE (userId, credentialsId),
    FOREIGN KEY (userId) REFERENCES user_entity(id) ON DELETE CASCADE,
    FOREIGN KEY (credentialsId) REFERENCES credentials_entity(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_token_user ON oauth_token_entity(userId);
CREATE INDEX IF NOT EXISTS idx_token_credentials ON oauth_token_entity(credentialsId);
CREATE INDEX IF NOT EXISTS idx_token_expiry ON oauth_token_entity(expiresAt);
CREATE INDEX IF NOT EXISTS idx_token_status ON oauth_token_entity(status);
CREATE INDEX IF NOT EXISTS idx_token_created ON oauth_token_entity(createdAt);
