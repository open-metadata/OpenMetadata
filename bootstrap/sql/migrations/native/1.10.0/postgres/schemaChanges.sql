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

-- Add migration_type column to SERVER_CHANGE_LOG table
ALTER TABLE "SERVER_CHANGE_LOG" ADD COLUMN migration_type VARCHAR(20) DEFAULT 'NATIVE';

-- Update existing records to be marked as NATIVE
UPDATE "SERVER_CHANGE_LOG" SET migration_type = 'NATIVE' WHERE migration_type IS NULL;