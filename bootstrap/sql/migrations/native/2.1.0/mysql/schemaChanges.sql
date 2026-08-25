-- Incident Manager grouped incidents - OpenMetadata 2.1.0

-- Index the stateId partition used by the incident grouping endpoint (/testCaseIncidentStatus/incidentGroups)
ALTER TABLE test_case_resolution_status_time_series ADD INDEX idx_test_case_resolution_status_state_id (stateId, timestamp);

-- Serve entityFQNHash-driven access on the incident timeline: the /testCaseIncidentStatus list
-- filters (testCaseFQN scope, testDefinition semi-join) and the incident grouping CTE scope all
-- seek by entityFQNHash; only id-leading and timestamp-leading indexes existed before.
ALTER TABLE test_case_resolution_status_time_series ADD INDEX idx_test_case_resolution_status_fqn_ts (entityFQNHash, timestamp);

-- test_case predates the PRIMARY KEY(id) convention of newer entity tables and had no id index,
-- so entity_relationship joins on toId = test_case.id (testDefinition incident filter) and
-- id-based lookups fall back to full scans.
ALTER TABLE test_case ADD INDEX idx_test_case_id (id);

-- The incident list's assignee filter compares the generated assignee column, which had no
-- index and full-scanned the timeline at scale.
ALTER TABLE test_case_resolution_status_time_series ADD INDEX idx_test_case_resolution_status_assignee (assignee, timestamp);

-- Incident summary table: one row per incident (stateId chain), maintained at write time so
-- state-shaped reads (incidentGroups) are O(open incidents) instead of folding full history.
-- Column names deliberately mirror the time-series table so ListFilter conditions apply verbatim.
CREATE TABLE IF NOT EXISTS test_case_incident (
    stateId varchar(36) NOT NULL,
    entityFQNHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    testCaseResolutionStatusType varchar(36) NOT NULL,
    assignee varchar(256) DEFAULT NULL,
    severity varchar(36) DEFAULT NULL,
    createdAt bigint unsigned NOT NULL,
    updatedAt bigint unsigned NOT NULL,
    latestRecordId varchar(36) NOT NULL,
    PRIMARY KEY (stateId),
    INDEX idx_tci_status_fqn (testCaseResolutionStatusType, entityFQNHash),
    INDEX idx_tci_fqn (entityFQNHash),
    INDEX idx_tci_assignee (assignee, testCaseResolutionStatusType),
    INDEX idx_tci_updated (updatedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Ontology Studio: governed relationship types, OWL annex, drafts, and edit locks.
CREATE TABLE IF NOT EXISTS relationship_type_entity (
  id varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.id'))) STORED NOT NULL,
  name varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.name'))) STORED NOT NULL,
  fqnHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  json json NOT NULL,
  updatedAt bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.updatedAt'))) STORED NOT NULL,
  updatedBy varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.updatedBy'))) STORED NOT NULL,
  deleted tinyint(1) GENERATED ALWAYS AS (json_extract(json, '$.deleted')) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY relationship_type_fqn_hash_unique (fqnHash),
  KEY relationship_type_name_index (name),
  KEY relationship_type_deleted_index (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ontology_axiom_entity (
  id varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.id'))) STORED NOT NULL,
  name varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.name'))) STORED NOT NULL,
  fqnHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  json json NOT NULL,
  glossaryId varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.glossary.id'))) STORED NOT NULL,
  axiomType varchar(64) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.axiomType'))) STORED NOT NULL,
  entityStatus varchar(32) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.entityStatus'))) STORED NOT NULL,
  updatedAt bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.updatedAt'))) STORED NOT NULL,
  updatedBy varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.updatedBy'))) STORED NOT NULL,
  deleted tinyint(1) GENERATED ALWAYS AS (json_extract(json, '$.deleted')) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY ontology_axiom_fqn_hash_unique (fqnHash),
  KEY ontology_axiom_name_index (name),
  KEY ontology_axiom_glossary_type_index (glossaryId, axiomType),
  KEY ontology_axiom_status_index (entityStatus),
  KEY ontology_axiom_deleted_index (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ontology_change_set_entity (
  id varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.id'))) STORED NOT NULL,
  name varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.name'))) STORED NOT NULL,
  fqnHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  json json NOT NULL,
  state varchar(32) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.state'))) STORED NOT NULL,
  updatedAt bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.updatedAt'))) STORED NOT NULL,
  updatedBy varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.updatedBy'))) STORED NOT NULL,
  deleted tinyint(1) GENERATED ALWAYS AS (json_extract(json, '$.deleted')) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY ontology_change_set_fqn_hash_unique (fqnHash),
  KEY ontology_change_set_name_index (name),
  KEY ontology_change_set_state_index (state),
  KEY ontology_change_set_updated_by_index (updatedBy),
  KEY ontology_change_set_deleted_index (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ontology_annex (
  glossaryId varchar(36) NOT NULL,
  revision bigint unsigned NOT NULL,
  canonicalNQuads longtext NOT NULL,
  checksum char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source varchar(32) NOT NULL,
  createdBy varchar(256) NOT NULL,
  createdAt bigint unsigned NOT NULL,
  PRIMARY KEY (glossaryId, revision),
  UNIQUE KEY ontology_annex_checksum_unique (glossaryId, checksum),
  KEY ontology_annex_created_at_index (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ontology_edit_lock (
  resourceType varchar(128) NOT NULL,
  resourceId varchar(36) NOT NULL,
  holderId varchar(36) NOT NULL,
  sessionId varchar(64) NOT NULL,
  version bigint unsigned NOT NULL,
  acquiredAt bigint unsigned NOT NULL,
  renewedAt bigint unsigned NOT NULL,
  expiresAt bigint unsigned NOT NULL,
  PRIMARY KEY (resourceType, resourceId),
  KEY ontology_edit_lock_expiry_index (expiresAt),
  KEY ontology_edit_lock_holder_index (holderId, sessionId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS rdf_inference_rule (
  name varchar(64) NOT NULL,
  json json NOT NULL,
  systemRule tinyint(1) NOT NULL DEFAULT 0,
  dirty tinyint(1) NOT NULL DEFAULT 1,
  deleted tinyint(1) NOT NULL DEFAULT 0,
  updatedAt bigint unsigned NOT NULL,
  lastMaterializedAt bigint unsigned DEFAULT NULL,
  lastTripleCount bigint unsigned NOT NULL DEFAULT 0,
  lastError text DEFAULT NULL,
  PRIMARY KEY (name),
  KEY rdf_inference_rule_dirty_index (dirty, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE entity_relationship ADD COLUMN relationshipId varchar(36) DEFAULT NULL;

ALTER TABLE entity_relationship ADD COLUMN relationshipTypeId varchar(36) DEFAULT NULL;

ALTER TABLE entity_relationship ADD UNIQUE KEY relationship_id_unique (relationshipId);

ALTER TABLE entity_relationship ADD KEY relationship_type_id_index (relationshipTypeId);

-- Pipeline-backed lineage is the only relationship lookup whose selective identifier lives in JSON.
-- Pairing it with relation serves every pipeline lineage path without widening the generic table schema.
CREATE INDEX idx_entity_relationship_pipeline_relation
ON entity_relationship (
    (CAST(json->>'$.pipeline.id' AS CHAR(36)) COLLATE utf8mb4_bin),
    relation
);

-- Switch Oracle services to python-oracledb's native SQLAlchemy dialect.
UPDATE dbservice_entity
SET json = JSON_SET(json, '$.connection.config.scheme', 'oracle+oracledb')
WHERE serviceType = 'Oracle'
  AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.connection.config.scheme')) = 'oracle+cx_oracle';
