-- Rename 'preview' to 'enabled' in apps, inverting the boolean value
-- preview=false (can be used) becomes enabled=true, preview=true becomes enabled=false
UPDATE apps_marketplace
SET json = (json - 'preview') || jsonb_build_object(
    'enabled',
    CASE
        WHEN json -> 'preview' = 'null'::jsonb THEN true
        WHEN (json -> 'preview')::boolean = true THEN false
        ELSE true
    END
)
WHERE jsonb_exists(json, 'preview');

UPDATE installed_apps
SET json = (json - 'preview') || jsonb_build_object(
    'enabled',
    CASE
        WHEN json -> 'preview' = 'null'::jsonb THEN true
        WHEN (json -> 'preview')::boolean = true THEN false
        ELSE true
    END
)
WHERE jsonb_exists(json, 'preview');

-- Add changeDescriptionDoc generated column to entity_extension for efficient field-change filtering
-- Supports filtering entity versions by specific metadata changes (e.g., tags, schema, description)
ALTER TABLE entity_extension
  ADD COLUMN IF NOT EXISTS changeDescriptionDoc TEXT
  GENERATED ALWAYS AS (json ->> 'changeDescription')
  STORED;
