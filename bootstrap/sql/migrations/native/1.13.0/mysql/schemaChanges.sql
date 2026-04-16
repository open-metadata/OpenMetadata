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
