ALTER TABLE entity_extension
  ADD COLUMN versionNum DOUBLE NULL,
  ADD COLUMN changedFieldKeys JSON NULL;

CREATE INDEX idx_entity_extension_version_order
  ON entity_extension (id, versionNum);

CREATE INDEX idx_entity_extension_changed_field_keys
  ON entity_extension ((CAST(changedFieldKeys->'$' AS CHAR(512) ARRAY)));
