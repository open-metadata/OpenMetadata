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

ALTER TABLE tag_usage
ADD COLUMN reason TEXT;
