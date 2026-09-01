-- Perf: UsageDAO.computePercentile runs four correlated COUNT(*) subqueries that each
-- filter entity_usage on (entityType, usageDate). The only existing index is
-- UNIQUE (id, usageDate), which is unusable for that predicate, so every run full-scans
-- the table once per subquery. A composite (entityType, usageDate) index turns the
-- percentile subqueries into range scans.
SET @entity_usage_percentile_index_ddl = (
  SELECT IF(
    COUNT(*) = 0,
    'CREATE INDEX idx_entity_usage_entitytype_usagedate ON entity_usage (entityType, usageDate)',
    'SELECT 1'
  )
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'entity_usage'
    AND index_name = 'idx_entity_usage_entitytype_usagedate'
);
PREPARE entity_usage_percentile_index_stmt FROM @entity_usage_percentile_index_ddl;
EXECUTE entity_usage_percentile_index_stmt;
DEALLOCATE PREPARE entity_usage_percentile_index_stmt;
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

-- Metric hierarchy is stored as CONTAINS rows in entity_relationship. Metric Group
-- membership is stored as HAS relationships so deleting a group leaves metrics intact.
CREATE TABLE IF NOT EXISTS metric_group_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.id'))) STORED NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.updatedAt'))) VIRTUAL NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.updatedBy'))) VIRTUAL NOT NULL,
    deleted TINYINT(1) GENERATED ALWAYS AS (json_extract(`json`, '$.deleted')) VIRTUAL,
    fqnHash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.name'))) VIRTUAL NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY metric_group_entity_fqn_hash (fqnHash),
    KEY metric_group_entity_name_index (name),
    KEY idx_metric_group_entity_deleted_name_id (deleted, name, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- A Metric can belong to only one Metric Group. The generated key is NULL for every other
-- relationship shape, so the unique index constrains only metricGroup --HAS--> metric rows.
-- Guard both operations because MySQL 8.0 versions do not consistently support IF NOT EXISTS
-- for ADD COLUMN and ADD INDEX.
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

-- Conversation V2 stores bounded roots and replies as schema-first JSON. Indexed mentions and
-- domains remain normalized because they participate in filters and authorization.
CREATE TABLE IF NOT EXISTS conversation_entity (
    id varchar(36) GENERATED ALWAYS AS
      (json_unquote(json_extract(json, _utf8mb4'$.id'))) STORED NOT NULL,
    source varchar(16) GENERATED ALWAYS AS
      (json_unquote(json_extract(json, _utf8mb4'$.source'))) STORED NOT NULL,
    entityType varchar(64) GENERATED ALWAYS AS
      (json_unquote(json_extract(json, _utf8mb4'$.entityRef.type'))) STORED NOT NULL,
    entityId varchar(36) GENERATED ALWAYS AS
      (json_unquote(json_extract(json, _utf8mb4'$.entityRef.id'))) STORED NOT NULL,
    entityFqnHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin,
    about varchar(2048) GENERATED ALWAYS AS
      (json_unquote(json_extract(json, _utf8mb4'$.about'))) STORED NOT NULL,
    aboutFqnHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin,
    activityEventId varchar(36) GENERATED ALWAYS AS
      (json_unquote(json_extract(json, _utf8mb4'$.activityEventId'))) STORED,
    creatorId varchar(36) GENERATED ALWAYS AS
      (json_unquote(json_extract(json, _utf8mb4'$.createdBy.id'))) STORED,
    createdAt bigint GENERATED ALWAYS AS
      (json_unquote(json_extract(json, _utf8mb4'$.createdAt'))) STORED NOT NULL,
    updatedAt bigint GENERATED ALWAYS AS
      (json_unquote(json_extract(json, _utf8mb4'$.updatedAt'))) STORED NOT NULL,
    resolved tinyint(1) GENERATED ALWAYS AS
      (json_extract(json, _utf8mb4'$.resolved')) STORED NOT NULL,
    replyCount int GENERATED ALWAYS AS
      (json_unquote(json_extract(json, _utf8mb4'$.replyCount'))) STORED NOT NULL,
    json json NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_conversation_activity_event (activityEventId),
    KEY idx_conversation_entity (entityType, entityId, updatedAt, id),
    KEY idx_conversation_entity_fqn (entityFqnHash, updatedAt, id),
    KEY idx_conversation_about (aboutFqnHash, updatedAt, id),
    KEY idx_conversation_creator (creatorId, updatedAt, id),
    KEY idx_conversation_source_updated (source, updatedAt, id),
    KEY idx_conversation_created (createdAt, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS conversation_reply (
    id varchar(36) GENERATED ALWAYS AS
      (json_unquote(json_extract(json, _utf8mb4'$.id'))) STORED NOT NULL,
    conversationId varchar(36) GENERATED ALWAYS AS
      (json_unquote(json_extract(json, _utf8mb4'$.conversationId'))) STORED NOT NULL,
    authorId varchar(36) GENERATED ALWAYS AS
      (json_unquote(json_extract(json, _utf8mb4'$.author.id'))) STORED NOT NULL,
    createdAt bigint GENERATED ALWAYS AS
      (json_unquote(json_extract(json, _utf8mb4'$.createdAt'))) STORED NOT NULL,
    updatedAt bigint GENERATED ALWAYS AS
      (json_unquote(json_extract(json, _utf8mb4'$.updatedAt'))) STORED NOT NULL,
    json json NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_conversation_reply_conversation
      FOREIGN KEY (conversationId) REFERENCES conversation_entity(id) ON DELETE CASCADE,
    KEY idx_conversation_reply_cursor (conversationId, createdAt, id),
    KEY idx_conversation_reply_author (authorId, createdAt, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS conversation_mention (
    conversationId varchar(36) NOT NULL,
    targetType varchar(16) NOT NULL,
    targetId varchar(36) NOT NULL,
    mentionedEntityType varchar(64) NOT NULL,
    mentionedEntityId varchar(36) NOT NULL,
    createdAt bigint NOT NULL,
    PRIMARY KEY (targetType, targetId, mentionedEntityType, mentionedEntityId),
    CONSTRAINT fk_conversation_mention_conversation
      FOREIGN KEY (conversationId) REFERENCES conversation_entity(id) ON DELETE CASCADE,
    KEY idx_conversation_mention_lookup
      (mentionedEntityType, mentionedEntityId, createdAt, conversationId),
    KEY idx_conversation_mention_conversation (conversationId, targetType, targetId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS conversation_domain (
    conversationId varchar(36) NOT NULL,
    domainId varchar(36) NOT NULL,
    PRIMARY KEY (conversationId, domainId),
    CONSTRAINT fk_conversation_domain_conversation
      FOREIGN KEY (conversationId) REFERENCES conversation_entity(id) ON DELETE CASCADE,
    KEY idx_conversation_domain_lookup (domainId, conversationId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET @drop_conversation_activity_timestamp_ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'conversation_entity'
        AND column_name = 'activityTimestamp'
    ),
    'ALTER TABLE conversation_entity DROP COLUMN activityTimestamp',
    'SELECT 1'
  )
);
PREPARE drop_conversation_activity_timestamp_stmt
  FROM @drop_conversation_activity_timestamp_ddl;
EXECUTE drop_conversation_activity_timestamp_stmt;
DEALLOCATE PREPARE drop_conversation_activity_timestamp_stmt;

SET @metric_group_membership_column_ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'entity_relationship'
        AND column_name = 'metricGroupMetricId'
    ),
    'SELECT 1',
    'ALTER TABLE entity_relationship ADD COLUMN metricGroupMetricId VARCHAR(36) GENERATED ALWAYS AS (CASE WHEN fromEntity = ''metricGroup'' AND toEntity = ''metric'' AND relation = 10 THEN toId ELSE NULL END) STORED'
  )
);
PREPARE metric_group_membership_column_stmt FROM @metric_group_membership_column_ddl;
EXECUTE metric_group_membership_column_stmt;
DEALLOCATE PREPARE metric_group_membership_column_stmt;

SET @metric_group_membership_index_ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'entity_relationship'
        AND index_name = 'uq_metric_group_single_membership'
    ),
    'SELECT 1',
    'ALTER TABLE entity_relationship ADD UNIQUE INDEX uq_metric_group_single_membership (metricGroupMetricId)'
  )
);
PREPARE metric_group_membership_index_stmt FROM @metric_group_membership_index_ddl;
EXECUTE metric_group_membership_index_stmt;
DEALLOCATE PREPARE metric_group_membership_index_stmt;

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

CREATE TABLE IF NOT EXISTS rdf_custom_ontology (
  name varchar(64) NOT NULL,
  json json NOT NULL,
  updatedAt bigint unsigned NOT NULL,
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
