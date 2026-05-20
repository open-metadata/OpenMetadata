-- Rename 'preview' to 'enabled' in apps, inverting the boolean value
-- preview=false (can be used) becomes enabled=true, preview=true becomes enabled=false
UPDATE apps_marketplace
SET json = JSON_SET(
    JSON_REMOVE(json, '$.preview'),
    '$.enabled',
    CASE
        WHEN JSON_EXTRACT(json, '$.preview') = true THEN CAST('false' AS JSON)
        ELSE CAST('true' AS JSON)
    END
)
WHERE JSON_CONTAINS_PATH(json, 'one', '$.preview');

UPDATE installed_apps
SET json = JSON_SET(
    JSON_REMOVE(json, '$.preview'),
    '$.enabled',
    CASE
        WHEN JSON_EXTRACT(json, '$.preview') = true THEN CAST('false' AS JSON)
        ELSE CAST('true' AS JSON)
    END
)
WHERE JSON_CONTAINS_PATH(json, 'one', '$.preview');

-- Reduce deadlocks for entity_usage upserts by making the unique key follow the lookup predicate
-- (id, usageDate) instead of (usageDate, id).
SET @migrate_usage_date_idx_sql := (
    SELECT CASE
               WHEN COUNT(*) = 0 THEN 'ALTER TABLE entity_usage ADD UNIQUE INDEX usageDate (id, usageDate)'
               WHEN SUM(seq_in_index = 1 AND column_name = 'id' AND non_unique = 0) > 0 THEN 'SELECT 1'
               ELSE 'ALTER TABLE entity_usage DROP INDEX usageDate, ADD UNIQUE INDEX usageDate (id, usageDate)'
        END
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'entity_usage'
      AND index_name = 'usageDate'
);
PREPARE migrate_usage_date_idx_stmt FROM @migrate_usage_date_idx_sql;
EXECUTE migrate_usage_date_idx_stmt;
DEALLOCATE PREPARE migrate_usage_date_idx_stmt;

-- Rename 'preview' to 'enabled' in event_subscription_entity config.app
-- The App JSON is stored as an escaped JSON string inside config.app, so we need string replacement
UPDATE event_subscription_entity
SET json = JSON_SET(
    json,
    '$.config.app',
    REPLACE(
        REPLACE(
            JSON_UNQUOTE(JSON_EXTRACT(json, '$.config.app')),
            '"preview":false',
            '"enabled":true'
        ),
        '"preview":true',
        '"enabled":false'
    )
)
WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.config.app')) LIKE '%"preview"%';

-- Clean up QRTZ tables to remove stale persisted job data that may contain old App JSON with 'preview'
-- Delete FK children first, then parents. Using DELETE (not TRUNCATE) to respect FK constraints.
-- NOTE: This migration must run with the application fully stopped.
-- Deleting QRTZ_LOCKS and QRTZ_SCHEDULER_STATE while the scheduler is running
-- will cause distributed lock failures and missed recovery.
DELETE FROM QRTZ_SIMPLE_TRIGGERS;
DELETE FROM QRTZ_CRON_TRIGGERS;
DELETE FROM QRTZ_SIMPROP_TRIGGERS;
DELETE FROM QRTZ_BLOB_TRIGGERS;
DELETE FROM QRTZ_TRIGGERS;
DELETE FROM QRTZ_JOB_DETAILS;
DELETE FROM QRTZ_FIRED_TRIGGERS;
DELETE FROM QRTZ_LOCKS;
DELETE FROM QRTZ_SCHEDULER_STATE;

-- Create mcp_service_entity table
CREATE TABLE IF NOT EXISTS mcp_service_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.id'))) STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.name'))) VIRTUAL NOT NULL,
    serviceType VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.serviceType'))) VIRTUAL NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.updatedAt'))) VIRTUAL NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`, '$.updatedBy'))) VIRTUAL NOT NULL,
    impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.impersonatedBy') VIRTUAL,
    deleted TINYINT(1) GENERATED ALWAYS AS (json_extract(`json`, '$.deleted')) VIRTUAL,
    nameHash VARCHAR(256) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY nameHash (nameHash),
    INDEX name_index (name),
    INDEX service_type_index (serviceType),
    INDEX deleted_index (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='MCP Service entities';

-- Create mcp_server_entity table
CREATE TABLE IF NOT EXISTS mcp_server_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.impersonatedBy') VIRTUAL,
    deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
    PRIMARY KEY (id),
    UNIQUE KEY unique_name (fqnHash),
    INDEX name_index (name),
    INDEX deleted_index (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='MCP Server entities';

-- Create mcp_execution_entity table
CREATE TABLE IF NOT EXISTS mcp_execution_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    serverId VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.serverId') STORED NOT NULL,
    json JSON NOT NULL,
    timestamp BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.timestamp') NOT NULL,
    PRIMARY KEY (id),
    INDEX server_index (serverId),
    INDEX timestamp_index (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='MCP Execution logs';

-- Enable allowImpersonation for McpApplicationBot so it can record impersonation in audit logs
UPDATE user_entity
SET json = JSON_SET(json, '$.allowImpersonation', true)
WHERE name = 'mcpapplicationbot';

-- Assign ApplicationBotImpersonationRole to the MCP bot user
-- Relationship.HAS ordinal = 10
INSERT IGNORE INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation)
SELECT ue.id, re.id, 'user', 'role', 10
FROM user_entity ue, role_entity re
WHERE ue.name = 'mcpapplicationbot'
  AND re.name = 'ApplicationBotImpersonationRole';

-- Update Databricks and Unity Catalog connection schemes from 'databricks+connector' to 'databricks'
-- as part of migration from sqlalchemy-databricks to databricks-sqlalchemy package
UPDATE dbservice_entity
SET json = JSON_SET(json, '$.connection.config.scheme', 'databricks')
WHERE serviceType IN ('Databricks', 'UnityCatalog')
  AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.connection.config.scheme')) = 'databricks+connector';

UPDATE entity_extension
SET json = JSON_SET(
    json,
    '$.profileSampleConfig',
    JSON_OBJECT(
        'sampleConfigType', 'STATIC',
        'config', JSON_OBJECT(
            'profileSample', JSON_EXTRACT(json, '$.profileSample'),
            'profileSampleType', COALESCE(
                JSON_EXTRACT(json, '$.profileSampleType'),
                CAST('"PERCENTAGE"' AS JSON)
            ),
            'samplingMethodType', JSON_EXTRACT(json, '$.samplingMethodType')
        )
    )
)
WHERE extension IN (
    'table.tableProfilerConfig',
    'database.databaseProfilerConfig',
    'databaseSchema.databaseSchemaProfilerConfig'
)
  AND JSON_EXTRACT(json, '$.profileSample') IS NOT NULL
  AND JSON_TYPE(JSON_EXTRACT(json, '$.profileSample')) != 'NULL'
  AND NOT JSON_CONTAINS_PATH(json, 'one', '$.profileSampleConfig');

-- entity_extension: remove old flat fields
UPDATE entity_extension
SET json = JSON_REMOVE(
    JSON_REMOVE(
        JSON_REMOVE(json, '$.samplingMethodType'),
        '$.profileSampleType'
    ),
    '$.profileSample'
)
WHERE extension IN (
    'table.tableProfilerConfig',
    'database.databaseProfilerConfig',
    'databaseSchema.databaseSchemaProfilerConfig'
)
  AND (JSON_CONTAINS_PATH(json, 'one', '$.profileSample')
    OR JSON_CONTAINS_PATH(json, 'one', '$.profileSampleType')
    OR JSON_CONTAINS_PATH(json, 'one', '$.samplingMethodType'));

-- ingestion_pipeline_entity (profiler pipelines): build profileSampleConfig (skip if already migrated)
UPDATE ingestion_pipeline_entity
SET json = JSON_SET(
    json,
    '$.sourceConfig.config.profileSampleConfig',
    JSON_OBJECT(
        'sampleConfigType', 'STATIC',
        'config', JSON_OBJECT(
            'profileSample', JSON_EXTRACT(json, '$.sourceConfig.config.profileSample'),
            'profileSampleType', COALESCE(
                JSON_EXTRACT(json, '$.sourceConfig.config.profileSampleType'),
                CAST('"PERCENTAGE"' AS JSON)
            ),
            'samplingMethodType', JSON_EXTRACT(json, '$.sourceConfig.config.samplingMethodType')
        )
    )
)
WHERE pipelineType = 'profiler'
  AND JSON_EXTRACT(json, '$.sourceConfig.config.profileSample') IS NOT NULL
  AND JSON_TYPE(JSON_EXTRACT(json, '$.sourceConfig.config.profileSample')) != 'NULL'
  AND NOT JSON_CONTAINS_PATH(json, 'one', '$.sourceConfig.config.profileSampleConfig');

-- ingestion_pipeline_entity (profiler pipelines): remove old flat fields
UPDATE ingestion_pipeline_entity
SET json = JSON_REMOVE(
    JSON_REMOVE(
        JSON_REMOVE(json, '$.sourceConfig.config.samplingMethodType'),
        '$.sourceConfig.config.profileSampleType'
    ),
    '$.sourceConfig.config.profileSample'
)
WHERE pipelineType = 'profiler'
  AND (JSON_CONTAINS_PATH(json, 'one', '$.sourceConfig.config.profileSample')
    OR JSON_CONTAINS_PATH(json, 'one', '$.sourceConfig.config.profileSampleType')
    OR JSON_CONTAINS_PATH(json, 'one', '$.sourceConfig.config.samplingMethodType'));

-- ingestion_pipeline_entity (testSuite pipelines): build profileSampleConfig (skip if already migrated)
UPDATE ingestion_pipeline_entity
SET json = JSON_SET(
    json,
    '$.sourceConfig.config.profileSampleConfig',
    JSON_OBJECT(
        'sampleConfigType', 'STATIC',
        'config', JSON_OBJECT(
            'profileSample', JSON_EXTRACT(json, '$.sourceConfig.config.profileSample'),
            'profileSampleType', COALESCE(
                JSON_EXTRACT(json, '$.sourceConfig.config.profileSampleType'),
                CAST('"PERCENTAGE"' AS JSON)
            ),
            'samplingMethodType', JSON_EXTRACT(json, '$.sourceConfig.config.samplingMethodType')
        )
    )
)
WHERE pipelineType = 'testSuite'
  AND JSON_EXTRACT(json, '$.sourceConfig.config.profileSample') IS NOT NULL
  AND JSON_TYPE(JSON_EXTRACT(json, '$.sourceConfig.config.profileSample')) != 'NULL'
  AND NOT JSON_CONTAINS_PATH(json, 'one', '$.sourceConfig.config.profileSampleConfig');

-- ingestion_pipeline_entity (testSuite pipelines): remove old flat fields
UPDATE ingestion_pipeline_entity
SET json = JSON_REMOVE(
    JSON_REMOVE(
        JSON_REMOVE(json, '$.sourceConfig.config.samplingMethodType'),
        '$.sourceConfig.config.profileSampleType'
    ),
    '$.sourceConfig.config.profileSample'
)
WHERE pipelineType = 'testSuite'
  AND (JSON_CONTAINS_PATH(json, 'one', '$.sourceConfig.config.profileSample')
    OR JSON_CONTAINS_PATH(json, 'one', '$.sourceConfig.config.profileSampleType')
    OR JSON_CONTAINS_PATH(json, 'one', '$.sourceConfig.config.samplingMethodType'));

-- RDF distributed indexing state tables
CREATE TABLE IF NOT EXISTS rdf_index_job (
    id VARCHAR(36) NOT NULL,
    status VARCHAR(32) NOT NULL,
    jobConfiguration JSON NOT NULL,
    totalRecords BIGINT NOT NULL DEFAULT 0,
    processedRecords BIGINT NOT NULL DEFAULT 0,
    successRecords BIGINT NOT NULL DEFAULT 0,
    failedRecords BIGINT NOT NULL DEFAULT 0,
    stats JSON,
    createdBy VARCHAR(256) NOT NULL,
    createdAt BIGINT NOT NULL,
    startedAt BIGINT,
    completedAt BIGINT,
    updatedAt BIGINT NOT NULL,
    errorMessage TEXT,
    PRIMARY KEY (id),
    INDEX idx_rdf_index_job_status (status),
    INDEX idx_rdf_index_job_created (createdAt DESC)
);

CREATE TABLE IF NOT EXISTS rdf_index_partition (
    id VARCHAR(36) NOT NULL,
    jobId VARCHAR(36) NOT NULL,
    entityType VARCHAR(128) NOT NULL,
    partitionIndex INT NOT NULL,
    rangeStart BIGINT NOT NULL,
    rangeEnd BIGINT NOT NULL,
    estimatedCount BIGINT NOT NULL,
    workUnits BIGINT NOT NULL,
    priority INT NOT NULL DEFAULT 50,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    processingCursor BIGINT NOT NULL DEFAULT 0,
    processedCount BIGINT NOT NULL DEFAULT 0,
    successCount BIGINT NOT NULL DEFAULT 0,
    failedCount BIGINT NOT NULL DEFAULT 0,
    assignedServer VARCHAR(255),
    claimedAt BIGINT,
    startedAt BIGINT,
    completedAt BIGINT,
    lastUpdateAt BIGINT,
    lastError TEXT,
    retryCount INT NOT NULL DEFAULT 0,
    claimableAt BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_rdf_partition_job_entity_idx (jobId, entityType, partitionIndex),
    INDEX idx_rdf_partition_job (jobId),
    INDEX idx_rdf_partition_status_priority (status, priority DESC),
    INDEX idx_rdf_partition_claimable (jobId, status, claimableAt),
    INDEX idx_rdf_partition_assigned_server (jobId, assignedServer),
    CONSTRAINT fk_rdf_partition_job FOREIGN KEY (jobId) REFERENCES rdf_index_job(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rdf_reindex_lock (
    lockKey VARCHAR(64) NOT NULL,
    jobId VARCHAR(36) NOT NULL,
    serverId VARCHAR(255) NOT NULL,
    acquiredAt BIGINT NOT NULL,
    lastHeartbeat BIGINT NOT NULL,
    expiresAt BIGINT NOT NULL,
    PRIMARY KEY (lockKey)
);

CREATE TABLE IF NOT EXISTS rdf_index_server_stats (
    id VARCHAR(36) NOT NULL,
    jobId VARCHAR(36) NOT NULL,
    serverId VARCHAR(256) NOT NULL,
    entityType VARCHAR(128) NOT NULL,
    processedRecords BIGINT DEFAULT 0,
    successRecords BIGINT DEFAULT 0,
    failedRecords BIGINT DEFAULT 0,
    partitionsCompleted INT DEFAULT 0,
    partitionsFailed INT DEFAULT 0,
    lastUpdatedAt BIGINT NOT NULL,
    PRIMARY KEY (id),
    UNIQUE INDEX idx_rdf_index_server_stats_job_server_entity (jobId, serverId, entityType),
    INDEX idx_rdf_index_server_stats_job_id (jobId)
);

-- Speeds up the NOT EXISTS anti-join used by ContainerDAO root-only listings
-- (?root=true&service=...). Covers the subquery's filter and projection so the
-- planner can answer "does this container have a parent?" with an index-only
-- scan instead of materializing the child-edge set.
CREATE INDEX idx_er_fromentity_toentity_relation_toid
    ON entity_relationship (fromEntity, toEntity, relation, toId);

-- Add per-stage cumulative timing columns to search_index_server_stats so the
-- distributed aggregator can surface where reindex latency is being spent
-- (DB read in Reader, doc-build in Process, OpenSearch bulk in Sink, embeddings
-- in Vector). Stored as BIGINT milliseconds; UI computes avg latency and
-- throughput client-side from totalTimeMs / successRecords.
ALTER TABLE search_index_server_stats
  ADD COLUMN readerTimeMs BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN processTimeMs BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN sinkTimeMs BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN vectorTimeMs BIGINT NOT NULL DEFAULT 0;

-- The Postgres counterpart to this file adds a `text_pattern_ops` index
-- on `fqnHash` for every entity table to make `?service=` / `?database=` /
-- `?databaseSchema=` / `?parent=` listings (which compile to
-- `fqnHash LIKE 'prefix%'`) index-driven instead of seq-scan-driven on RDS.
-- MySQL does not need an equivalent: every entity-table `fqnHash` column is
-- already declared `CHARACTER SET ascii COLLATE ascii_bin`, a binary
-- collation that lets the existing unique B-tree on `fqnHash` answer LIKE
-- prefix predicates directly. No change required on the MySQL side.

-- MCP OAuth: state parameter is opaque per RFC 6749 §4.1.1 and some clients (notably the
-- Databricks MCP Proxy) send tokens longer than 255 characters. Widen mcp_state to TEXT to
-- avoid INSERT failures on /mcp/authorize redirects.
ALTER TABLE mcp_pending_auth_requests
    MODIFY COLUMN mcp_state TEXT;

-- Allow multiple typed relations between the same pair of glossary terms.
-- The previous PRIMARY KEY (fromId, toId, relation) caused INSERT ... ON DUPLICATE
-- KEY UPDATE to overwrite the json discriminator when a second relationType
-- ("synonym" + "seeAlso", etc.) was added between the same two terms, silently
-- dropping the first relationship. Adding relationType to the PK lets the same
-- (fromId, toId, RELATED_TO) pair carry one row per relation type.
-- `IF NOT EXISTS` on `ADD COLUMN` only landed in MySQL 8.0.29; supported 8.0.x
-- deployments may be older, so use plain ADD COLUMN. SERVER_CHANGE_LOG gates
-- re-execution at the framework level — same reasoning as the PK swap below.
ALTER TABLE entity_relationship
    ADD COLUMN `relationType` varchar(64) NOT NULL DEFAULT '' AFTER `relation`;

-- Backfill relationType for every glossary-term ↔ glossary-term RELATED_TO row.
-- Pre-1.13 data has json = NULL (no discriminator existed yet) — those rows MUST
-- collapse onto 'relatedTo' so that a subsequent insert of the same logical
-- relation matches the existing row instead of creating a duplicate under a
-- different PK. relation=15 is the ordinal of Relationship.RELATED_TO (see
-- openmetadata-spec entityRelationship.json). 'relatedTo' is the default
-- relation type that the application code uses when none is specified.
UPDATE entity_relationship
SET relationType =
    COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(json, '$.relationType')), ''), 'relatedTo')
WHERE fromEntity = 'glossaryTerm'
  AND toEntity = 'glossaryTerm'
  AND relation = 15;

-- Swap the PK to include relationType. The native migration framework tracks
-- completion in SERVER_CHANGE_LOG so this runs once per upgrade; we intentionally
-- avoid information_schema gating because least-privilege migration users may
-- not have SELECT on it. A manual replay of this step on an already-migrated
-- table will rebuild the PK with the same columns — wasteful but not broken.
ALTER TABLE entity_relationship
    DROP PRIMARY KEY,
    ADD PRIMARY KEY (`fromId`, `toId`, `relation`, `relationType`);
