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
