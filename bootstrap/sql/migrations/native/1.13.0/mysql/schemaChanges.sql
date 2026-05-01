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

CREATE INDEX idx_thread_type_resolved_createdAt ON thread_entity(type, resolved, createdAt DESC);

CREATE INDEX idx_thread_entity_entityId ON thread_entity(entityId);

CREATE INDEX idx_thread_entity_type_announcementDates ON thread_entity(type, announcementStart, announcementEnd);

CREATE INDEX idx_thread_entity_createdBy_type ON thread_entity(createdBy, type);

CREATE INDEX idx_thread_entity_type_taskStatus_createdAt ON thread_entity(type, taskStatus, createdAt DESC);

DROP INDEX thread_type_index on thread_entity;

DROP INDEX updated_at_index on thread_entity;

CREATE INDEX idx_table_entity_deleted_fqnHash ON table_entity(deleted, fqnHash);

CREATE INDEX idx_table_entity_name_id ON table_entity(name, id);

CREATE INDEX idx_dashboard_entity_deleted_name_id ON dashboard_entity(deleted, name, id);

DROP INDEX index_dashboard_entity_deleted on dashboard_entity;

CREATE INDEX idx_pipeline_entity_deleted_name_id ON pipeline_entity(deleted, name, id);

DROP INDEX index_pipeline_entity_deleted ON pipeline_entity;

CREATE INDEX idx_chart_entity_deleted_name_id ON chart_entity(deleted, name, id);

DROP INDEX index_chart_entity_deleted on chart_entity;

CREATE INDEX idx_topic_entity_deleted_name_id ON topic_entity(deleted, name, id);

DROP INDEX index_topic_entity_deleted on topic_entity;

CREATE INDEX idx_ml_model_entity_deleted_name_id ON ml_model_entity(deleted, name, id);

DROP INDEX index_ml_model_entity_deleted on ml_model_entity;

CREATE INDEX idx_storage_container_entity_deleted_name_id ON storage_container_entity(deleted, name, id);

DROP INDEX index_storage_container_entity_deleted ON storage_container_entity;

CREATE INDEX idx_database_entity_deleted_name_id ON database_entity(deleted, name, id);

DROP INDEX index_database_entity_deleted ON database_entity;

CREATE INDEX idx_database_schema_entity_deleted_name_id ON database_schema_entity(deleted, name, id);

DROP INDEX index_database_schema_entity_deleted ON database_schema_entity;

CREATE INDEX idx_glossary_term_entity_deleted_name_id ON glossary_term_entity(deleted, name, id);

DROP INDEX index_glossary_term_entity_deleted ON glossary_term_entity;

CREATE INDEX idx_metric_entity_deleted_name_id ON metric_entity(deleted, name, id);

DROP INDEX index_metric_entity_deleted on metric_entity;

CREATE INDEX idx_report_entity_deleted_name_id ON report_entity(deleted, name, id);

DROP INDEX index_report_entity_deleted ON report_entity;

CREATE INDEX idx_stored_procedure_entity_deleted_name_id ON stored_procedure_entity(deleted, name, id);

DROP INDEX index_stored_procedure_entity_deleted ON stored_procedure_entity;

CREATE INDEX idx_search_index_entity_deleted_name_id ON search_index_entity(deleted, name, id);

DROP INDEX index_search_index_entity_deleted ON search_index_entity;

CREATE INDEX idx_api_endpoint_entity_deleted_name_id ON api_endpoint_entity(deleted, name, id);

CREATE INDEX idx_api_collection_entity_deleted_name_id ON api_collection_entity(deleted, name, id);

CREATE INDEX idx_dashboard_data_model_entity_deleted_name_id ON dashboard_data_model_entity(deleted, name, id);

DROP INDEX index_dashboard_data_model_entity_deleted ON dashboard_data_model_entity;

CREATE INDEX idx_dbservice_entity_deleted_name ON dbservice_entity(deleted, name);

DROP INDEX index_dbservice_entity_deleted ON dbservice_entity;

CREATE INDEX idx_dashboard_service_entity_deleted_name ON dashboard_service_entity(deleted, name);

DROP INDEX index_dashboard_service_entity_deleted ON dashboard_service_entity;

CREATE INDEX idx_messaging_service_entity_deleted_name ON messaging_service_entity(deleted, name);

DROP INDEX index_messaging_service_entity_deleted ON messaging_service_entity;

CREATE INDEX idx_metadata_service_entity_deleted_name ON metadata_service_entity(deleted, name);

DROP INDEX index_metadata_service_entity_deleted ON metadata_service_entity;

CREATE INDEX idx_mlmodel_service_entity_deleted_name ON mlmodel_service_entity(deleted, name);

DROP INDEX index_mlmodel_service_entity_deleted ON mlmodel_service_entity;

CREATE INDEX idx_pipeline_service_entity_deleted_name ON pipeline_service_entity(deleted, name);

DROP INDEX index_pipeline_service_entity_deleted ON pipeline_service_entity;

CREATE INDEX idx_storage_service_entity_deleted_name ON storage_service_entity(deleted, name);

DROP INDEX index_storage_service_entity_deleted ON storage_service_entity;

CREATE INDEX idx_search_service_entity_deleted_name ON search_service_entity(deleted, name);

DROP INDEX index_search_service_entity_deleted ON search_service_entity;

CREATE INDEX idx_api_service_entity_deleted_name ON api_service_entity(deleted, name);

CREATE INDEX idx_team_entity_deleted_name ON team_entity(deleted, name);

DROP INDEX index_team_entity_deleted ON team_entity;

CREATE INDEX idx_role_entity_deleted_name ON role_entity(deleted, name);

DROP INDEX index_role_entity_deleted ON role_entity;

CREATE INDEX idx_policy_entity_deleted_name_id ON policy_entity(deleted, name, id);

DROP INDEX index_policy_entity_deleted ON policy_entity;

CREATE INDEX idx_user_entity_deleted_name ON user_entity(deleted, name);

DROP INDEX index_user_entity_deleted ON user_entity;

CREATE INDEX idx_glossary_entity_deleted_name ON glossary_entity(deleted, name);

DROP INDEX index_glossary_entity_deleted ON glossary_entity;

CREATE INDEX idx_bot_entity_deleted_name ON bot_entity(deleted, name);

DROP INDEX index_bot_entity_deleted ON bot_entity;

CREATE INDEX idx_kpi_entity_deleted_name ON kpi_entity(deleted, name);

DROP INDEX index_kpi_entity_deleted ON kpi_entity;

CREATE INDEX idx_ingestion_pipeline_entity_deleted_name_id ON ingestion_pipeline_entity(deleted, name, id);

DROP INDEX index_ingestion_pipeline_entity_deleted ON ingestion_pipeline_entity;

CREATE INDEX idx_data_contract_entity_deleted_name_id ON data_contract_entity(deleted, name, id);

DROP INDEX index_data_contract_entity_deleted ON data_contract_entity;

CREATE INDEX idx_er_fromentity_toentity_relation_toid
    ON entity_relationship (fromEntity, toEntity, relation, toId);
