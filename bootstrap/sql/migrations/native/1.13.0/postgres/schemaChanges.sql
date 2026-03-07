-- Add changeDescriptionDoc generated column to entity_extension for efficient field-change filtering
-- Supports filtering entity versions by specific metadata changes (e.g., tags, schema, description)
ALTER TABLE entity_extension
  ADD COLUMN IF NOT EXISTS changeDescriptionDoc TEXT
  GENERATED ALWAYS AS (json ->> 'changeDescription')
  STORED;
