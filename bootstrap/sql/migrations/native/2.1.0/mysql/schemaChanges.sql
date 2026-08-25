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
