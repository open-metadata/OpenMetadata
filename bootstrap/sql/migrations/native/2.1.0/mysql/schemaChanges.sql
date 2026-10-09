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

-- Only active Metric Group HAS edges participate in the single-membership constraint so a
-- soft-deleted membership does not block reassignment.
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
    'ALTER TABLE entity_relationship ADD COLUMN metricGroupMetricId VARCHAR(36) GENERATED ALWAYS AS (CASE WHEN fromEntity = ''metricGroup'' AND toEntity = ''metric'' AND relation = 10 AND deleted = FALSE THEN toId ELSE NULL END) STORED'
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

-- Data quality dimensions become first class entities (issue #30362): test definitions and test
-- cases point at them by relationship so that a dimension can be renamed, recoloured or added
-- without touching the tests that use it. System dimensions are seeded from
-- json/data/dataQualityDimension on startup.
-- An earlier revision of this (unreleased) migration declared `id` as a plain column. Because
-- EntityDAO.insert only writes fqnHash and json, MySQL rejected every insert with "Field 'id'
-- doesn't have a default value". The table is dropped unconditionally rather than patched: it is
-- new in this unreleased version, so any existing copy is either empty (the broken shape could not
-- be inserted into) or holds nothing but the system dimensions, which are re-seeded from
-- json/data/dataQualityDimension on the next startup.
DROP TABLE IF EXISTS data_quality_dimension;
CREATE TABLE data_quality_dimension (
    -- EntityDAO.insert only writes fqnHash and json, so every other column has to be derived
    -- from the json document, id included.
    id varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.id'))) STORED NOT NULL,
    json json NOT NULL,
    fqnHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.name'))) STORED NOT NULL,
    provider varchar(32) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.provider'))) STORED,
    updatedAt bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.updatedAt'))) STORED NOT NULL,
    deleted tinyint(1) GENERATED ALWAYS AS (json_extract(json, '$.deleted')) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uk_data_quality_dimension_fqn_hash (fqnHash),
    KEY idx_data_quality_dimension_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS rdf_custom_ontology (
  name varchar(64) NOT NULL,
  json json NOT NULL,
  updatedAt bigint unsigned NOT NULL,
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Restore the audit log full-text index where it is missing.
-- 1.12.1 created it, but the ALTER TABLE that precedes it in that script has no IF NOT EXISTS, so
-- on any deployment where search_text already existed the script aborted before reaching the index
-- and every `q=` audit search has been a full table scan since.
SET @ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'audit_log_event'
        AND index_name = 'idx_audit_log_search_text'
    ),
    'SELECT 1',
    'CREATE FULLTEXT INDEX idx_audit_log_search_text ON audit_log_event (search_text)'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- event_type and entity_type are filterable on their own and pair with the event_ts ordering every
-- list query uses; without them a filtered page scans every row in the time window.
SET @ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'audit_log_event'
        AND index_name = 'idx_audit_log_event_type_ts'
    ),
    'SELECT 1',
    'CREATE INDEX idx_audit_log_event_type_ts ON audit_log_event (event_type, event_ts DESC)'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'audit_log_event'
        AND index_name = 'idx_audit_log_entity_type_ts'
    ),
    'SELECT 1',
    'CREATE INDEX idx_audit_log_entity_type_ts ON audit_log_event (entity_type, event_ts DESC)'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index automations_workflow.updatedAt for the DataRetention app's workflow cleanup, which
-- selects the oldest expired rows with `WHERE updatedAt < ? ORDER BY updatedAt LIMIT ?` once per
-- batch. Without it that is a full scan plus a top-k sort of a table that grows unbounded with
-- test connection, query runner and reverse ingestion runs. MySQL has no
-- `CREATE INDEX IF NOT EXISTS`, so guard via information_schema.
SET @ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'automations_workflow'
        AND index_name = 'idx_automations_workflow_updated_at'
    ),
    'SELECT 1',
    'CREATE INDEX idx_automations_workflow_updated_at ON automations_workflow (updatedAt)'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- audit_log_event.entity_fqn stores the raw FQN. For lineage events that FQN is two
-- entity FQNs joined by the relationship marker, so ordinary deeply-nested entities
-- push it past 768 characters; the insert then fails and AuditLogRepository drops the
-- row with only a WARN, losing audit history silently. Nothing indexes entity_fqn --
-- lookups go through entity_fqn_hash (idx_audit_log_event_entity_hash_ts), an
-- MD5-per-segment digest that stays far inside its own bound -- so the column has no
-- reason to be length-capped.
SET @ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'audit_log_event'
        AND column_name = 'entity_fqn'
        AND data_type = 'text'
    ),
    'SELECT 1',
    'ALTER TABLE audit_log_event MODIFY COLUMN entity_fqn TEXT NULL'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Announcement type: stored generated column so the list API can filter by type. Rows written
-- before the field existed have no $.type and read back as the Notice default.
SET @announcement_type_column_ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'announcement_entity'
        AND column_name = 'type'
    ),
    'SELECT 1',
    'ALTER TABLE announcement_entity ADD COLUMN type varchar(32) GENERATED ALWAYS AS (COALESCE(json_unquote(json_extract(`json`, ''$.type'')), ''Notice'')) STORED'
  )
);
PREPARE announcement_type_column_stmt FROM @announcement_type_column_ddl;
EXECUTE announcement_type_column_stmt;
DEALLOCATE PREPARE announcement_type_column_stmt;

SET @announcement_type_index_ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'announcement_entity'
        AND index_name = 'idx_announcement_type'
    ),
    'SELECT 1',
    'ALTER TABLE announcement_entity ADD INDEX idx_announcement_type (type)'
  )
);
PREPARE announcement_type_index_stmt FROM @announcement_type_index_ddl;
EXECUTE announcement_type_index_stmt;
DEALLOCATE PREPARE announcement_type_index_stmt;

-- Allow Data Consumer to run agent SPARQL queries by default (#34231). Seed data never updates a policy
-- that already exists, so existing installs get the rule here. The rule is only added while an allow
-- rule of the policy still lists ViewAll, since the grant is acceptable only where Data Consumers can
-- already view everything. Deny rules in other policies are not visible to this statement.
UPDATE policy_entity
SET json = JSON_ARRAY_APPEND(
    json,
    '$.rules',
    JSON_OBJECT(
        'name', 'DataConsumerPolicy-ExecuteSparqlQuery-Rule',
        'description', 'Allow authenticated users to run read-only SPARQL queries through the agent SPARQL endpoint. The endpoint does not filter results by asset, so remove this rule if viewing is restricted through custom policies.',
        'resources', JSON_ARRAY('all'),
        'operations', JSON_ARRAY('ExecuteSparqlQuery'),
        'effect', 'allow'
    )
)
WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.name')) = 'DataConsumerPolicy'
  AND NOT JSON_CONTAINS(json, JSON_OBJECT('name', 'DataConsumerPolicy-ExecuteSparqlQuery-Rule'), '$.rules')
  AND JSON_CONTAINS(json, JSON_OBJECT('effect', 'allow', 'operations', JSON_ARRAY('ViewAll')), '$.rules');

-- SSO Test Login (#28784). A test spans several requests (start, the identity provider's callback,
-- the result polls, the credentials) that can reach different servers, so its state lives here
-- rather than in one server's memory. pending_state holds the candidate configuration with its
-- secrets, Fernet-encrypted, and is cleared when the test completes; rows expire minutes later.
CREATE TABLE IF NOT EXISTS sso_test_login_session (
    test_session_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    admin_principal VARCHAR(256) NOT NULL,
    protocol VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL,
    pending_state MEDIUMTEXT,
    result MEDIUMTEXT,
    credentials_submitted_at BIGINT,
    expires_at BIGINT NOT NULL,
    PRIMARY KEY (test_session_id),
    INDEX idx_sso_test_login_session_admin (admin_principal, credentials_submitted_at),
    INDEX idx_sso_test_login_session_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- #33980 shipped this column while the type enum still read Information/Warning/Issue. The enum
-- has since been renamed so the stored value matches what the UI shows (Notice/Critical). A
-- version is reprocessed statement-by-statement against SERVER_MIGRATION_SQL_LOGS, and the
-- ADD COLUMN above is both unchanged (so it never re-runs) and guarded on the column's existence
-- (so it would be a no-op if it did). Any database that already applied 2.1.0 therefore still
-- holds the old names, and must be rewritten here.
UPDATE announcement_entity
SET json = JSON_SET(json, '$.type', 'Notice')
WHERE json_unquote(json_extract(json, '$.type')) = 'Information';

UPDATE announcement_entity
SET json = JSON_SET(json, '$.type', 'Critical')
WHERE json_unquote(json_extract(json, '$.type')) = 'Issue';

-- Rows predating #33980 carry no $.type at all and read back through the column's COALESCE
-- default, so the default has to move with the enum or `?type=Notice` never matches them.
SET @announcement_type_default_ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'announcement_entity'
        AND column_name = 'type'
        AND generation_expression LIKE '%Information%'
    ),
    'ALTER TABLE announcement_entity MODIFY COLUMN type varchar(32) GENERATED ALWAYS AS (COALESCE(json_unquote(json_extract(`json`, ''$.type'')), ''Notice'')) STORED',
    'SELECT 1'
  )
);
PREPARE announcement_type_default_stmt FROM @announcement_type_default_ddl;
EXECUTE announcement_type_default_stmt;
DEALLOCATE PREPARE announcement_type_default_stmt;

-- Direct-child container listings (issue #22530). "Children of <fqn>" was expressed as
-- `fqnHash LIKE '<parent>.%' AND fqnHash NOT LIKE '<parent>.%.%'`. Neither predicate is an
-- indexable equality, so with the listing's `ORDER BY name, id LIMIT n` the optimizer prefers
-- idx_storage_container_entity_deleted_name_id -- which already delivers that order -- and
-- scans container rows until the page fills. A container near the root of a deep tree has few
-- direct children, so the scan runs to completion: cost is O(containers in the deployment),
-- not O(direct children). Measured on a 14-level, 10k-container S3 tree whose root has one
-- direct child: 10,376 rows scanned / 90ms, rising to 50,376 rows / 169ms once unrelated
-- containers were added -- while the answer stayed a single row.
--
-- parentFqnHash materialises the fqnHash prefix above the last segment, turning the listing
-- into an index equality. Derived by stripping the final '.'-separated segment rather than a
-- fixed 33-character suffix, so it holds regardless of hash width. VIRTUAL keeps the ALTER
-- metadata-only (no table rebuild); the index below materialises the value.
--
-- Both statements are guarded so a re-run is a no-op, like the rest of this file. The
-- prepared-statement names are unique on purpose: the runner records each statement by
-- (version, hash of its text) and skips text it has already run, so a second block reusing
-- `PREPARE stmt FROM @ddl; EXECUTE stmt;` would be skipped rather than executed.
SET @container_parent_fqn_hash_column_ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'storage_container_entity'
        AND column_name = 'parentFqnHash'
    ),
    'SELECT 1',
    'ALTER TABLE storage_container_entity ADD COLUMN parentFqnHash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (CASE WHEN LOCATE(''.'', REVERSE(fqnHash)) = 0 THEN '''' ELSE LEFT(fqnHash, CHAR_LENGTH(fqnHash) - LOCATE(''.'', REVERSE(fqnHash))) END) VIRTUAL'
  )
);
PREPARE container_parent_fqn_hash_column_stmt FROM @container_parent_fqn_hash_column_ddl;
EXECUTE container_parent_fqn_hash_column_stmt;
DEALLOCATE PREPARE container_parent_fqn_hash_column_stmt;

-- (parentFqnHash, deleted) answers the filter; (name, id) supplies the listing's sort order,
-- so the common non-deleted page needs neither a filesort nor a row lookup per candidate.
-- Column order deviates from the table_entity/stored_procedure_entity precedent in 1.10.0,
-- which leads with `deleted`: the container listing's `include` is tri-state, and on
-- include=ALL there is no `deleted` predicate at all, which would strand a deleted-leading
-- index. Leading with parentFqnHash keeps the equality usable in all three include modes.
--
-- No CONCURRENTLY equivalent is needed here (and MySQL has none): InnoDB builds a secondary
-- index with ALGORITHM=INPLACE and permits concurrent DML, and the VIRTUAL column add above
-- is metadata-only, so neither statement blocks traffic. The PostgreSQL companion has to
-- build CONCURRENTLY and still pays an ACCESS EXCLUSIVE table rewrite for its STORED column.
SET @container_parent_children_index_ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'storage_container_entity'
        AND index_name = 'idx_storage_container_entity_parent_children'
    ),
    'SELECT 1',
    'ALTER TABLE storage_container_entity ADD INDEX idx_storage_container_entity_parent_children (parentFqnHash, deleted, name, id)'
  )
);
PREPARE container_parent_children_index_stmt FROM @container_parent_children_index_ddl;
EXECUTE container_parent_children_index_stmt;
DEALLOCATE PREPARE container_parent_children_index_stmt;

-- Announcement status is derived from startTime/endTime on every read and the ?status= filter
-- compares the window directly. Nothing rewrote the stored value when the window opened or
-- closed, so it only went stale: drop the column (its index goes with it) and the stored value.
SET @announcement_status_column_ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'announcement_entity'
        AND column_name = 'status'
    ),
    'ALTER TABLE announcement_entity DROP COLUMN status',
    'SELECT 1'
  )
);
PREPARE announcement_status_column_stmt FROM @announcement_status_column_ddl;
EXECUTE announcement_status_column_stmt;
DEALLOCATE PREPARE announcement_status_column_stmt;

UPDATE announcement_entity
SET json = JSON_REMOVE(json, '$.status')
WHERE JSON_EXTRACT(json, '$.status') IS NOT NULL;

-- Flowable schema upgrades run after this migration and inherit the database default. Existing
-- ACT_* tables are aligned to the same collation by FlowableCharsetMigration.
ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- Alert jobs are stored with the runtime's own job class, whatever consumer the alert names, so a
-- stored job never names a consumer class. A job a previous release stored under a consumer's
-- class is moved to it here; the alert reconciler would otherwise do it, one round at a time.
UPDATE QRTZ_JOB_DETAILS
SET JOB_CLASS_NAME = 'org.openmetadata.service.events.consumer.ConsumerJob'
WHERE SCHED_NAME = 'OMEventSubScheduler' AND JOB_GROUP = 'OMAlertJobGroup';
