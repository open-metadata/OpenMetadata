-- IntakeForm entity table: per-entity-type governance-required-field configuration
CREATE TABLE IF NOT EXISTS intake_form_entity (
  id VARCHAR(36) GENERATED ALWAYS AS ((json ->> 'id')) STORED NOT NULL,
  name VARCHAR(256) GENERATED ALWAYS AS ((json ->> 'name')) STORED NOT NULL,
  fqnHash VARCHAR(256) NOT NULL,
  entityType VARCHAR(64) GENERATED ALWAYS AS ((json ->> 'entityType')) STORED NOT NULL,
  json JSONB NOT NULL,
  updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
  updatedBy VARCHAR(256) GENERATED ALWAYS AS ((json ->> 'updatedBy')) STORED NOT NULL,
  deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
  PRIMARY KEY (id),
  UNIQUE (fqnHash),
  UNIQUE (entityType)
);

-- This version also carries a data migration (see Java migration postgres/v1131/Migration):
-- re-derive unparseable pipeline task FQNs persisted before double-quote escaping was supported.
-- Repaired task FQNs are reflected in the search index after the standard post-upgrade reindex.
