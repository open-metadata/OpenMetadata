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
