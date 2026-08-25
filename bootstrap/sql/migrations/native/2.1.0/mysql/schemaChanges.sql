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
