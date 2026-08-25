-- Incident Manager grouped incidents - OpenMetadata 2.1.0

-- Index the stateId partition used by the incident grouping endpoint (/testCaseIncidentStatus/incidentGroups)
CREATE INDEX IF NOT EXISTS idx_test_case_resolution_status_state_id ON test_case_resolution_status_time_series (stateId, timestamp);

-- Serve entityFQNHash-driven access on the incident timeline: the /testCaseIncidentStatus list
-- filters (testCaseFQN scope, testDefinition semi-join) and the incident grouping CTE scope all
-- seek by entityFQNHash; only id-leading and timestamp-leading indexes existed before.
CREATE INDEX IF NOT EXISTS idx_test_case_resolution_status_fqn_ts ON test_case_resolution_status_time_series (entityFQNHash, timestamp);

-- test_case predates the PRIMARY KEY(id) convention of newer entity tables and had no id index,
-- so entity_relationship joins on toId = test_case.id (testDefinition incident filter) and
-- id-based lookups fall back to full scans.
CREATE INDEX IF NOT EXISTS idx_test_case_id ON test_case (id);

-- The incident list's assignee filter compares the generated assignee column, which had no
-- index and full-scanned the timeline at scale.
CREATE INDEX IF NOT EXISTS idx_test_case_resolution_status_assignee ON test_case_resolution_status_time_series (assignee, timestamp);

-- Incident summary table: one row per incident (stateId chain), maintained at write time so
-- state-shaped reads (incidentGroups) are O(open incidents) instead of folding full history.
-- Column names deliberately mirror the time-series table so ListFilter conditions apply verbatim.
CREATE TABLE IF NOT EXISTS test_case_incident (
    stateId varchar(36) NOT NULL,
    entityFQNHash varchar(768) NOT NULL,
    testCaseResolutionStatusType varchar(36) NOT NULL,
    assignee varchar(256) DEFAULT NULL,
    severity varchar(36) DEFAULT NULL,
    createdAt bigint NOT NULL,
    updatedAt bigint NOT NULL,
    latestRecordId varchar(36) NOT NULL,
    PRIMARY KEY (stateId)
);
CREATE INDEX IF NOT EXISTS idx_tci_status_fqn ON test_case_incident (testCaseResolutionStatusType, entityFQNHash);
CREATE INDEX IF NOT EXISTS idx_tci_fqn ON test_case_incident (entityFQNHash);
CREATE INDEX IF NOT EXISTS idx_tci_assignee ON test_case_incident (assignee, testCaseResolutionStatusType);
CREATE INDEX IF NOT EXISTS idx_tci_updated ON test_case_incident (updatedAt);

-- Ontology Studio: governed relationship types, OWL annex, drafts, and edit locks.
CREATE TABLE IF NOT EXISTS relationship_type_entity (
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
  name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
  fqnHash VARCHAR(768) NOT NULL,
  json JSONB NOT NULL,
  updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
  updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
  deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
  PRIMARY KEY (id),
  CONSTRAINT relationship_type_fqn_hash_unique UNIQUE (fqnHash)
);
CREATE INDEX IF NOT EXISTS relationship_type_name_index ON relationship_type_entity (name);
CREATE INDEX IF NOT EXISTS relationship_type_deleted_index ON relationship_type_entity (deleted);

CREATE TABLE IF NOT EXISTS ontology_axiom_entity (
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
  name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
  fqnHash VARCHAR(768) NOT NULL,
  json JSONB NOT NULL,
  glossaryId VARCHAR(36) GENERATED ALWAYS AS (json -> 'glossary' ->> 'id') STORED NOT NULL,
  axiomType VARCHAR(64) GENERATED ALWAYS AS (json ->> 'axiomType') STORED NOT NULL,
  entityStatus VARCHAR(32) GENERATED ALWAYS AS (json ->> 'entityStatus') STORED NOT NULL,
  updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
  updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
  deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
  PRIMARY KEY (id),
  CONSTRAINT ontology_axiom_fqn_hash_unique UNIQUE (fqnHash)
);
CREATE INDEX IF NOT EXISTS ontology_axiom_name_index ON ontology_axiom_entity (name);
CREATE INDEX IF NOT EXISTS ontology_axiom_glossary_type_index ON ontology_axiom_entity (glossaryId, axiomType);
CREATE INDEX IF NOT EXISTS ontology_axiom_status_index ON ontology_axiom_entity (entityStatus);
CREATE INDEX IF NOT EXISTS ontology_axiom_deleted_index ON ontology_axiom_entity (deleted);

CREATE TABLE IF NOT EXISTS ontology_change_set_entity (
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
  name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
  fqnHash VARCHAR(768) NOT NULL,
  json JSONB NOT NULL,
  state VARCHAR(32) GENERATED ALWAYS AS (json ->> 'state') STORED NOT NULL,
  updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
  updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
  deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
  PRIMARY KEY (id),
  CONSTRAINT ontology_change_set_fqn_hash_unique UNIQUE (fqnHash)
);
CREATE INDEX IF NOT EXISTS ontology_change_set_name_index ON ontology_change_set_entity (name);
CREATE INDEX IF NOT EXISTS ontology_change_set_state_index ON ontology_change_set_entity (state);
CREATE INDEX IF NOT EXISTS ontology_change_set_updated_by_index ON ontology_change_set_entity (updatedBy);
CREATE INDEX IF NOT EXISTS ontology_change_set_deleted_index ON ontology_change_set_entity (deleted);

CREATE TABLE IF NOT EXISTS ontology_annex (
  glossaryId VARCHAR(36) NOT NULL,
  revision BIGINT NOT NULL,
  canonicalNQuads TEXT NOT NULL,
  checksum CHAR(64) NOT NULL,
  source VARCHAR(32) NOT NULL,
  createdBy VARCHAR(256) NOT NULL,
  createdAt BIGINT NOT NULL,
  PRIMARY KEY (glossaryId, revision),
  CONSTRAINT ontology_annex_checksum_unique UNIQUE (glossaryId, checksum)
);
CREATE INDEX IF NOT EXISTS ontology_annex_created_at_index ON ontology_annex (createdAt);

CREATE TABLE IF NOT EXISTS ontology_edit_lock (
  resourceType VARCHAR(128) NOT NULL,
  resourceId VARCHAR(36) NOT NULL,
  holderId VARCHAR(36) NOT NULL,
  sessionId VARCHAR(64) NOT NULL,
  version BIGINT NOT NULL,
  acquiredAt BIGINT NOT NULL,
  renewedAt BIGINT NOT NULL,
  expiresAt BIGINT NOT NULL,
  PRIMARY KEY (resourceType, resourceId)
);
CREATE INDEX IF NOT EXISTS ontology_edit_lock_expiry_index ON ontology_edit_lock (expiresAt);
CREATE INDEX IF NOT EXISTS ontology_edit_lock_holder_index ON ontology_edit_lock (holderId, sessionId);

CREATE TABLE IF NOT EXISTS rdf_inference_rule (
  name VARCHAR(64) NOT NULL,
  json JSONB NOT NULL,
  systemRule BOOLEAN NOT NULL DEFAULT FALSE,
  dirty BOOLEAN NOT NULL DEFAULT TRUE,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  updatedAt BIGINT NOT NULL,
  lastMaterializedAt BIGINT,
  lastTripleCount BIGINT NOT NULL DEFAULT 0,
  lastError TEXT,
  PRIMARY KEY (name)
);
CREATE INDEX IF NOT EXISTS rdf_inference_rule_dirty_index
  ON rdf_inference_rule (dirty, deleted);

ALTER TABLE entity_relationship
  ADD COLUMN IF NOT EXISTS relationshipId VARCHAR(36),
  ADD COLUMN IF NOT EXISTS relationshipTypeId VARCHAR(36);

CREATE UNIQUE INDEX IF NOT EXISTS relationship_id_unique
  ON entity_relationship (relationshipId);
CREATE INDEX IF NOT EXISTS entity_relationship_type_id_index
  ON entity_relationship (relationshipTypeId);

-- Pipeline-backed lineage is the only relationship lookup whose selective identifier lives in JSON.
-- The partial index avoids write amplification for relationships that have no pipeline metadata.
CREATE INDEX IF NOT EXISTS idx_entity_relationship_pipeline_relation
ON entity_relationship ((json->'pipeline'->>'id'), relation)
WHERE (json->'pipeline'->>'id') IS NOT NULL;

-- Switch Oracle services to python-oracledb's native SQLAlchemy dialect.
UPDATE dbservice_entity
SET json = jsonb_set(json::jsonb, '{connection,config,scheme}', '"oracle+oracledb"')
WHERE serviceType = 'Oracle'
  AND json #>> '{connection,config,scheme}' = 'oracle+cx_oracle';
