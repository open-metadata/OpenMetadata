-- Rename 'preview' to 'enabled' in apps, inverting the boolean value
-- preview=false (can be used) becomes enabled=true, preview=true becomes enabled=false
UPDATE apps_marketplace
SET json = (json - 'preview') || jsonb_build_object(
    'enabled',
    CASE
        WHEN json -> 'preview' = 'null'::jsonb THEN true
        WHEN (json -> 'preview')::boolean = true THEN false
        ELSE true
    END
)
WHERE jsonb_exists(json, 'preview');

UPDATE installed_apps
SET json = (json - 'preview') || jsonb_build_object(
    'enabled',
    CASE
        WHEN json -> 'preview' = 'null'::jsonb THEN true
        WHEN (json -> 'preview')::boolean = true THEN false
        ELSE true
    END
)
WHERE jsonb_exists(json, 'preview');

-- Reduce deadlocks for entity_usage upserts by reordering the unique constraint columns
-- to (id, usageDate) so that row-level locks follow the lookup predicate order.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_attribute a1 ON a1.attrelid = c.conrelid AND a1.attnum = c.conkey[1]
        JOIN pg_attribute a2 ON a2.attrelid = c.conrelid AND a2.attnum = c.conkey[2]
        WHERE c.conrelid = 'entity_usage'::regclass
          AND c.contype = 'u'
          AND a1.attname = 'id'
          AND a2.attname = 'usageDate'
    ) THEN
        -- Drop the old constraint (usageDate, id) if it exists
        IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'entity_usage'::regclass AND contype = 'u'
        ) THEN
            EXECUTE format('ALTER TABLE entity_usage DROP CONSTRAINT %I',
                (SELECT conname FROM pg_constraint WHERE conrelid = 'entity_usage'::regclass AND contype = 'u' LIMIT 1));
        END IF;
        ALTER TABLE entity_usage ADD CONSTRAINT entity_usage_id_usagedate_key UNIQUE (id, usageDate);
    END IF;
END $$;

-- Rename 'preview' to 'enabled' in event_subscription_entity config.app
-- The App JSON is stored as an escaped JSON string inside config.app, so we need string replacement
UPDATE event_subscription_entity
SET json = jsonb_set(
    json,
    '{config,app}',
    to_jsonb(
        replace(
            replace(
                json->'config'->>'app',
                '"preview":false',
                '"enabled":true'
            ),
            '"preview":true',
            '"enabled":false'
        )
    )
)
WHERE json->'config'->>'app' LIKE '%"preview"%';

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

-- Migrate profiler sampling config: move flat profileSample/profileSampleType/samplingMethodType
-- into the new profileSampleConfig structure. Default to STATIC since DYNAMIC is new.

-- Profiler configs are stored in entity_extension table, not in entity json columns.
-- Extension keys: table.tableProfilerConfig, database.databaseProfilerConfig, databaseSchema.databaseSchemaProfilerConfig
-- The json column in entity_extension contains the config object directly (flat root-level fields).

-- entity_extension: build profileSampleConfig from existing flat fields (skip if already migrated)
UPDATE entity_extension
SET json = jsonb_set(
    json::jsonb,
    '{profileSampleConfig}',
    jsonb_build_object(
        'sampleConfigType', 'STATIC',
        'config', jsonb_build_object(
            'profileSample', json::jsonb #> '{profileSample}',
            'profileSampleType', COALESCE(
                json::jsonb #> '{profileSampleType}',
                '"PERCENTAGE"'::jsonb
            ),
            'samplingMethodType', json::jsonb #> '{samplingMethodType}'
        )
    )
)::json
WHERE extension IN (
    'table.tableProfilerConfig',
    'database.databaseProfilerConfig',
    'databaseSchema.databaseSchemaProfilerConfig'
)
  AND json::jsonb #>> '{profileSample}' IS NOT NULL
  AND json::jsonb #> '{profileSampleConfig}' IS NULL;

-- entity_extension: remove old flat fields
UPDATE entity_extension
SET json = (json::jsonb #- '{profileSample}'
                        #- '{profileSampleType}'
                        #- '{samplingMethodType}')::json
WHERE extension IN (
    'table.tableProfilerConfig',
    'database.databaseProfilerConfig',
    'databaseSchema.databaseSchemaProfilerConfig'
)
  AND (json::jsonb #>> '{profileSample}' IS NOT NULL
    OR json::jsonb #>> '{profileSampleType}' IS NOT NULL
    OR json::jsonb #>> '{samplingMethodType}' IS NOT NULL);

-- ingestion_pipeline_entity (profiler pipelines): build profileSampleConfig (skip if already migrated)
UPDATE ingestion_pipeline_entity
SET json = jsonb_set(
    json::jsonb,
    '{sourceConfig,config,profileSampleConfig}',
    jsonb_build_object(
        'sampleConfigType', 'STATIC',
        'config', jsonb_build_object(
            'profileSample', json::jsonb #> '{sourceConfig,config,profileSample}',
            'profileSampleType', COALESCE(
                json::jsonb #> '{sourceConfig,config,profileSampleType}',
                '"PERCENTAGE"'::jsonb
            ),
            'samplingMethodType', json::jsonb #> '{sourceConfig,config,samplingMethodType}'
        )
    )
)::json
WHERE json #>> '{pipelineType}' = 'profiler'
  AND json::jsonb #>> '{sourceConfig,config,profileSample}' IS NOT NULL
  AND json::jsonb #> '{sourceConfig,config,profileSampleConfig}' IS NULL;

-- ingestion_pipeline_entity (profiler pipelines): remove old flat fields
UPDATE ingestion_pipeline_entity
SET json = (json::jsonb #- '{sourceConfig,config,profileSample}'
                        #- '{sourceConfig,config,profileSampleType}'
                        #- '{sourceConfig,config,samplingMethodType}')::json
WHERE json #>> '{pipelineType}' = 'profiler'
  AND (json::jsonb #>> '{sourceConfig,config,profileSample}' IS NOT NULL
    OR json::jsonb #>> '{sourceConfig,config,profileSampleType}' IS NOT NULL
    OR json::jsonb #>> '{sourceConfig,config,samplingMethodType}' IS NOT NULL);

-- RDF distributed indexing state tables
CREATE TABLE IF NOT EXISTS rdf_index_job (
    id VARCHAR(36) NOT NULL,
    status VARCHAR(32) NOT NULL,
    jobConfiguration JSONB NOT NULL,
    totalRecords BIGINT NOT NULL DEFAULT 0,
    processedRecords BIGINT NOT NULL DEFAULT 0,
    successRecords BIGINT NOT NULL DEFAULT 0,
    failedRecords BIGINT NOT NULL DEFAULT 0,
    stats JSONB,
    createdBy VARCHAR(256) NOT NULL,
    createdAt BIGINT NOT NULL,
    startedAt BIGINT,
    completedAt BIGINT,
    updatedAt BIGINT NOT NULL,
    errorMessage TEXT,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_rdf_index_job_status ON rdf_index_job(status);
CREATE INDEX IF NOT EXISTS idx_rdf_index_job_created ON rdf_index_job(createdAt DESC);

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
    UNIQUE (jobId, entityType, partitionIndex),
    CONSTRAINT fk_rdf_partition_job FOREIGN KEY (jobId) REFERENCES rdf_index_job(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rdf_partition_job ON rdf_index_partition(jobId);
CREATE INDEX IF NOT EXISTS idx_rdf_partition_status_priority ON rdf_index_partition(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_rdf_partition_claimable ON rdf_index_partition(jobId, status, claimableAt);
CREATE INDEX IF NOT EXISTS idx_rdf_partition_assigned_server ON rdf_index_partition(jobId, assignedServer);

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
    UNIQUE (jobId, serverId, entityType)
);

CREATE INDEX IF NOT EXISTS idx_rdf_index_server_stats_job_id ON rdf_index_server_stats(jobId);


CREATE INDEX IF NOT EXISTS idx_er_fromentity_toentity_relation_toid
    ON entity_relationship (fromEntity, toEntity, relation, toId);
