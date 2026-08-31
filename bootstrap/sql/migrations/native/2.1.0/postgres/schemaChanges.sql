-- Perf: UsageDAO.computePercentile runs four correlated COUNT(*) subqueries that each
-- filter entity_usage on (entityType, usageDate). The only existing index is
-- UNIQUE (id, usageDate), which is unusable for that predicate, so every run sequential-scans
-- the table once per subquery. A composite (entityType, usageDate) index turns the
-- percentile subqueries into range scans.
CREATE INDEX IF NOT EXISTS idx_entity_usage_entitytype_usagedate
    ON entity_usage (entityType, usageDate);

-- Correctness: migration 1.6.3 defined the Postgres isBot generated column as
-- (json ->> 'deleted')::boolean instead of (json ->> 'isBot'), so on Postgres isBot has
-- always mirrored `deleted` rather than the real bot flag. countDailyActiveUsers (and any
-- isBot column filter) was therefore wrong on Postgres. Postgres cannot alter a generated
-- column's expression in place, so backfill any rows missing $.isBot, drop the column
-- (this also drops idx_isBot) and recreate it reading the correct path.
-- Operational note: ADD COLUMN ... STORED rewrites the whole user_entity table and holds an
-- ACCESS EXCLUSIVE lock for its duration, and the backfill UPDATE below also scans the full
-- table. On deployments with a very large user_entity, run this migration in a maintenance
-- window; runtime scales with row count (typically seconds, but minutes for millions of users).
-- The change is one-time, idempotent, and Postgres-only (MySQL 1.6.3 was already correct).
UPDATE user_entity SET json = jsonb_set(json, '{isBot}', 'false'::jsonb, true)
    WHERE (json ->> 'isBot') IS NULL;
ALTER TABLE user_entity DROP COLUMN IF EXISTS isBot;
ALTER TABLE user_entity
    ADD COLUMN isBot BOOLEAN GENERATED ALWAYS AS ((json ->> 'isBot')::boolean) STORED NOT NULL;
CREATE INDEX IF NOT EXISTS idx_isBot ON user_entity (isBot);
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

-- Metric hierarchy is stored as CONTAINS rows in entity_relationship. Metric Group
-- membership is stored as HAS relationships so deleting a group leaves metrics intact.
CREATE TABLE IF NOT EXISTS metric_group_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    fqnHash VARCHAR(768) DEFAULT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

CREATE INDEX IF NOT EXISTS metric_group_entity_name_index ON metric_group_entity (name);
CREATE INDEX IF NOT EXISTS idx_metric_group_entity_deleted_name_id ON metric_group_entity (deleted, name, id);

-- A Metric can belong to only one Metric Group while every other HAS relationship remains
-- unconstrained by this partial index.
CREATE UNIQUE INDEX IF NOT EXISTS uq_metric_group_single_membership
    ON entity_relationship (toId)
    WHERE fromEntity = 'metricGroup' AND toEntity = 'metric' AND relation = 10;
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

-- Conversation V2 stores bounded roots and replies as schema-first JSON. Indexed mentions and
-- domains remain normalized because they participate in filters and authorization.
CREATE TABLE IF NOT EXISTS conversation_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    source character varying(16) GENERATED ALWAYS AS ((json ->> 'source'::text)) STORED NOT NULL,
    entityType character varying(64) GENERATED ALWAYS AS
      ((json #>> '{entityRef,type}'::text[])) STORED NOT NULL,
    entityId character varying(36) GENERATED ALWAYS AS
      ((json #>> '{entityRef,id}'::text[])) STORED NOT NULL,
    entityFqnHash character varying(768),
    about character varying(2048) GENERATED ALWAYS AS ((json ->> 'about'::text)) STORED NOT NULL,
    aboutFqnHash character varying(768),
    activityEventId character varying(36) GENERATED ALWAYS AS
      ((json ->> 'activityEventId'::text)) STORED,
    creatorId character varying(36) GENERATED ALWAYS AS
      ((json #>> '{createdBy,id}'::text[])) STORED,
    createdAt bigint GENERATED ALWAYS AS
      (((json ->> 'createdAt'::text))::bigint) STORED NOT NULL,
    updatedAt bigint GENERATED ALWAYS AS
      (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    resolved boolean GENERATED ALWAYS AS
      (((json ->> 'resolved'::text))::boolean) STORED NOT NULL,
    replyCount integer GENERATED ALWAYS AS
      (((json ->> 'replyCount'::text))::integer) STORED NOT NULL,
    json jsonb NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_conversation_activity_event UNIQUE (activityEventId)
);

CREATE INDEX IF NOT EXISTS idx_conversation_entity
    ON conversation_entity (entityType, entityId, updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_entity_fqn
    ON conversation_entity (entityFqnHash, updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_about
    ON conversation_entity (aboutFqnHash, updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_creator
    ON conversation_entity (creatorId, updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_source_updated
    ON conversation_entity (source, updatedAt DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_created
    ON conversation_entity (createdAt, id);

CREATE TABLE IF NOT EXISTS conversation_reply (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    conversationId character varying(36) GENERATED ALWAYS AS
      ((json ->> 'conversationId'::text)) STORED NOT NULL,
    authorId character varying(36) GENERATED ALWAYS AS
      ((json #>> '{author,id}'::text[])) STORED NOT NULL,
    createdAt bigint GENERATED ALWAYS AS
      (((json ->> 'createdAt'::text))::bigint) STORED NOT NULL,
    updatedAt bigint GENERATED ALWAYS AS
      (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    json jsonb NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_conversation_reply_conversation
      FOREIGN KEY (conversationId) REFERENCES conversation_entity(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conversation_reply_cursor
    ON conversation_reply (conversationId, createdAt, id);
CREATE INDEX IF NOT EXISTS idx_conversation_reply_author
    ON conversation_reply (authorId, createdAt, id);

CREATE TABLE IF NOT EXISTS conversation_mention (
    conversationId character varying(36) NOT NULL,
    targetType character varying(16) NOT NULL,
    targetId character varying(36) NOT NULL,
    mentionedEntityType character varying(64) NOT NULL,
    mentionedEntityId character varying(36) NOT NULL,
    createdAt bigint NOT NULL,
    PRIMARY KEY (targetType, targetId, mentionedEntityType, mentionedEntityId),
    CONSTRAINT fk_conversation_mention_conversation
      FOREIGN KEY (conversationId) REFERENCES conversation_entity(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conversation_mention_lookup
    ON conversation_mention (mentionedEntityType, mentionedEntityId, createdAt, conversationId);
CREATE INDEX IF NOT EXISTS idx_conversation_mention_conversation
    ON conversation_mention (conversationId, targetType, targetId);

CREATE TABLE IF NOT EXISTS conversation_domain (
    conversationId character varying(36) NOT NULL,
    domainId character varying(36) NOT NULL,
    PRIMARY KEY (conversationId, domainId),
    CONSTRAINT fk_conversation_domain_conversation
      FOREIGN KEY (conversationId) REFERENCES conversation_entity(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conversation_domain_lookup
    ON conversation_domain (domainId, conversationId);

ALTER TABLE conversation_entity DROP COLUMN IF EXISTS activityTimestamp;

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

CREATE TABLE IF NOT EXISTS rdf_custom_ontology (
  name VARCHAR(64) NOT NULL,
  json JSONB NOT NULL,
  updatedAt BIGINT NOT NULL,
  PRIMARY KEY (name)
);
