ALTER TABLE entity_extension
  ADD COLUMN IF NOT EXISTS versionNum DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS changedFieldKeys JSONB;

CREATE INDEX IF NOT EXISTS idx_entity_extension_version_order
  ON entity_extension (id, versionNum DESC)
  WHERE versionNum IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entity_extension_changed_field_keys
  ON entity_extension USING GIN (changedFieldKeys)
  WHERE changedFieldKeys IS NOT NULL;
