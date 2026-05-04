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

-- Enable allowImpersonation for McpApplicationBot so it can record impersonation in audit logs
UPDATE user_entity
SET json = jsonb_set(json::jsonb, '{allowImpersonation}', 'true')::json
WHERE name = 'mcpapplicationbot';

-- Create mcp_service_entity table
CREATE TABLE IF NOT EXISTS mcp_service_entity (
    id VARCHAR(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    serviceType VARCHAR(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json->>'impersonatedBy') STORED,
    deleted BOOLEAN GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    nameHash VARCHAR(256) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (nameHash)
);

CREATE INDEX IF NOT EXISTS mcp_service_name_index ON mcp_service_entity(name);
CREATE INDEX IF NOT EXISTS mcp_service_type_index ON mcp_service_entity(serviceType);
CREATE INDEX IF NOT EXISTS mcp_service_deleted_index ON mcp_service_entity(deleted);

COMMENT ON TABLE mcp_service_entity IS 'MCP Service entities';

-- Create mcp_server_entity table
CREATE TABLE IF NOT EXISTS mcp_server_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json->>'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json->>'name') STORED NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json->>'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json->>'updatedBy') STORED NOT NULL,
    impersonatedBy VARCHAR(256) GENERATED ALWAYS AS (json->>'impersonatedBy') STORED,
    deleted BOOLEAN GENERATED ALWAYS AS ((json->>'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

CREATE INDEX IF NOT EXISTS mcp_server_name_index ON mcp_server_entity(name);
CREATE INDEX IF NOT EXISTS mcp_server_deleted_index ON mcp_server_entity(deleted);

COMMENT ON TABLE mcp_server_entity IS 'MCP Server entities';

-- Create mcp_execution_entity table
CREATE TABLE IF NOT EXISTS mcp_execution_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json->>'id') STORED NOT NULL,
    serverId VARCHAR(36) GENERATED ALWAYS AS (json->>'serverId') STORED NOT NULL,
    json JSONB NOT NULL,
    timestamp BIGINT GENERATED ALWAYS AS ((json->>'timestamp')::bigint) STORED NOT NULL,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS mcp_execution_server_index ON mcp_execution_entity(serverId);
CREATE INDEX IF NOT EXISTS mcp_execution_timestamp_index ON mcp_execution_entity(timestamp);

COMMENT ON TABLE mcp_execution_entity IS 'MCP Execution logs';

-- Assign ApplicationBotImpersonationRole to the MCP bot user
-- Relationship.HAS ordinal = 10
INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation)
SELECT ue.id, re.id, 'user', 'role', 10
FROM user_entity ue, role_entity re
WHERE ue.name = 'mcpapplicationbot'
  AND re.name = 'ApplicationBotImpersonationRole'
ON CONFLICT DO NOTHING;

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

-- Speeds up the NOT EXISTS anti-join used by ContainerDAO root-only listings
-- (?root=true&service=...). Covers the subquery's filter and projection so the
-- planner can answer "does this container have a parent?" with an index-only
-- scan instead of materializing the child-edge set.
CREATE INDEX IF NOT EXISTS idx_er_fromentity_toentity_relation_toid
    ON entity_relationship (fromEntity, toEntity, relation, toId);

-- Add per-stage cumulative timing columns to search_index_server_stats so the
-- distributed aggregator can surface where reindex latency is being spent
-- (DB read in Reader, doc-build in Process, OpenSearch bulk in Sink, embeddings
-- in Vector). Stored as BIGINT milliseconds; UI computes avg latency and
-- throughput client-side from totalTimeMs / successRecords.
ALTER TABLE search_index_server_stats
  ADD COLUMN IF NOT EXISTS readerTimeMs BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processTimeMs BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sinkTimeMs BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vectorTimeMs BIGINT NOT NULL DEFAULT 0;

-- Speed up `?service=` / `?database=` / `?databaseSchema=` / `?parent=` /
-- `?apiCollection=` / `?spreadsheet=` / `?testSuite=` listings on entity
-- tables. ListFilter.getFqnPrefixCondition turns each of these query params
-- into a `<table>.fqnHash LIKE :prefix%` predicate. The unique B-tree index
-- on `fqnHash` uses the default operator class, and the column inherits the
-- database default collation (typically `en_US.UTF-8` on managed Postgres /
-- RDS). Neither qualifies the planner to use the index for `LIKE 'prefix%'`,
-- so count(*) and the page query degrade to a parallel seq scan over the
-- JSONB heap — observed at ~3s on a ~580k-row storage_container_entity table
-- even with ANALYZE / VACUUM tuned. A pattern-ops index supports LIKE-prefix
-- lookups regardless of column collation, dropping cold count(*) on a
-- service-filtered listing from seconds to tens of milliseconds.
--
-- Why `text_pattern_ops` and not `varchar_pattern_ops`:
-- `fqnHash` is declared `VARCHAR(768)` / `VARCHAR(256)`, so on paper
-- `varchar_pattern_ops` is the type-matched choice. In practice the planner
-- normalizes `varchar LIKE text` (which is what every JDBC `setString` call
-- and any `encode(...)`-derived RHS produces) by casting the column to text:
-- the resulting filter expression is `(fqnhash)::text ~~ ...`. The
-- `varchar_pattern_ops` opclass does NOT match that cast expression — the
-- index is silently unused and the table seq-scans. `text_pattern_ops`
-- matches `(varchar_col)::text ~~ ...` and gets picked up. Confirmed via
-- EXPLAIN ANALYZE on a 580k-row storage_container_entity: the same query
-- drops from ~470ms cold (Parallel Seq Scan) to <1ms (Index Scan) after
-- recreating the index with `text_pattern_ops`.
--
-- Built CONCURRENTLY so the migration does not take a write lock on these
-- tables (matches the 1.11.0 `idx_tag_usage_*` pattern). Each statement runs
-- outside an implicit transaction, which the OpenMetadata native migration
-- runner already supports — see 1.11.0/postgres/schemaChanges.sql.
--
-- Recreate, not "create if missing": the original 1.13.0 ship of these indexes
-- used `varchar_pattern_ops` (incorrect — see the "Why text_pattern_ops" block
-- above). On already-upgraded environments the old index already exists under
-- the same name with the wrong opclass, and a plain `CREATE INDEX CONCURRENTLY
-- IF NOT EXISTS` would no-op against that. We DROP first so the new SQL text
-- (which `MigrationProcessImpl` keys on by hash, so it re-runs even after the
-- old version was applied) actually replaces the existing index. On a fresh
-- install the DROP is a no-op via `IF EXISTS`. The CREATE keeps `IF NOT EXISTS`
-- only as a defensive against an interrupted-then-resumed migration where the
-- DROP succeeded but the CREATE was killed before completion.
--
-- OPERATOR RUNBOOK — interrupted CONCURRENTLY builds.
-- If a `CREATE INDEX CONCURRENTLY` is interrupted (deploy timeout, lock
-- contention, OOM, connection drop), Postgres leaves an INVALID index
-- behind. The `MigrationProcessImpl` runner caches statements by SQL text
-- hash, so an embedded cleanup step cannot be made to re-run on retry — this
-- is a known pattern-level gap (also present in 1.11.0).
--
-- Detection (run on the affected tenant):
--   SELECT c.relname FROM pg_class c
--    JOIN pg_index i ON i.indexrelid = c.oid
--    WHERE NOT i.indisvalid
--      AND c.relname LIKE 'idx\_%\_fqnhash\_pattern' ESCAPE '\';
-- Remediation: `DROP INDEX CONCURRENTLY <relname>;` for each row, then
-- delete the corresponding row from server_migration_sql_logs so the
-- runner re-attempts the CREATE on the next deploy:
--   DELETE FROM server_migration_sql_logs
--    WHERE version = '1.13.0'
--      AND sqlstatement LIKE '%idx\_<table>\_fqnhash\_pattern%' ESCAPE '\';
--
-- `pipeline_entity` is intentionally excluded: ListFilter.getServiceCondition
-- special-cases `pipeline_entity` to an EXISTS join on
-- `pipeline_service_entity` by service name (not `fqnHash LIKE`), and
-- PipelineResource.list exposes no other prefix-LIKE filter, so a pattern
-- index on `pipeline_entity.fqnHash` would be unused write overhead.
--
-- MySQL is unaffected: every entity-table `fqnHash` column ships with
-- `CHARACTER SET ascii COLLATE ascii_bin`, a binary collation that already
-- permits prefix scans on the unique index. This pass is Postgres-only.
DROP INDEX CONCURRENTLY IF EXISTS idx_chart_entity_fqnhash_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chart_entity_fqnhash_pattern
    ON chart_entity (fqnHash text_pattern_ops);
DROP INDEX CONCURRENTLY IF EXISTS idx_dashboard_entity_fqnhash_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dashboard_entity_fqnhash_pattern
    ON dashboard_entity (fqnHash text_pattern_ops);
DROP INDEX CONCURRENTLY IF EXISTS idx_dashboard_data_model_entity_fqnhash_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dashboard_data_model_entity_fqnhash_pattern
    ON dashboard_data_model_entity (fqnHash text_pattern_ops);
DROP INDEX CONCURRENTLY IF EXISTS idx_database_entity_fqnhash_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_database_entity_fqnhash_pattern
    ON database_entity (fqnHash text_pattern_ops);
DROP INDEX CONCURRENTLY IF EXISTS idx_database_schema_entity_fqnhash_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_database_schema_entity_fqnhash_pattern
    ON database_schema_entity (fqnHash text_pattern_ops);
DROP INDEX CONCURRENTLY IF EXISTS idx_glossary_term_entity_fqnhash_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_glossary_term_entity_fqnhash_pattern
    ON glossary_term_entity (fqnHash text_pattern_ops);
DROP INDEX CONCURRENTLY IF EXISTS idx_ingestion_pipeline_entity_fqnhash_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ingestion_pipeline_entity_fqnhash_pattern
    ON ingestion_pipeline_entity (fqnHash text_pattern_ops);
DROP INDEX CONCURRENTLY IF EXISTS idx_metric_entity_fqnhash_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metric_entity_fqnhash_pattern
    ON metric_entity (fqnHash text_pattern_ops);
DROP INDEX CONCURRENTLY IF EXISTS idx_ml_model_entity_fqnhash_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_model_entity_fqnhash_pattern
    ON ml_model_entity (fqnHash text_pattern_ops);
DROP INDEX CONCURRENTLY IF EXISTS idx_policy_entity_fqnhash_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_policy_entity_fqnhash_pattern
    ON policy_entity (fqnHash text_pattern_ops);
DROP INDEX CONCURRENTLY IF EXISTS idx_query_entity_fqnhash_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_query_entity_fqnhash_pattern
    ON query_entity (fqnHash text_pattern_ops);
DROP INDEX CONCURRENTLY IF EXISTS idx_report_entity_fqnhash_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_report_entity_fqnhash_pattern
    ON report_entity (fqnHash text_pattern_ops);
DROP INDEX CONCURRENTLY IF EXISTS idx_search_index_entity_fqnhash_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_index_entity_fqnhash_pattern
    ON search_index_entity (fqnHash text_pattern_ops);
DROP INDEX CONCURRENTLY IF EXISTS idx_storage_container_entity_fqnhash_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_storage_container_entity_fqnhash_pattern
    ON storage_container_entity (fqnHash text_pattern_ops);
DROP INDEX CONCURRENTLY IF EXISTS idx_table_entity_fqnhash_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_table_entity_fqnhash_pattern
    ON table_entity (fqnHash text_pattern_ops);
DROP INDEX CONCURRENTLY IF EXISTS idx_test_case_fqnhash_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_test_case_fqnhash_pattern
    ON test_case (fqnHash text_pattern_ops);
DROP INDEX CONCURRENTLY IF EXISTS idx_topic_entity_fqnhash_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_topic_entity_fqnhash_pattern
    ON topic_entity (fqnHash text_pattern_ops);
DROP INDEX CONCURRENTLY IF EXISTS idx_api_collection_entity_fqnhash_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_collection_entity_fqnhash_pattern
    ON api_collection_entity (fqnHash text_pattern_ops);
DROP INDEX CONCURRENTLY IF EXISTS idx_api_endpoint_entity_fqnhash_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_endpoint_entity_fqnhash_pattern
    ON api_endpoint_entity (fqnHash text_pattern_ops);
DROP INDEX CONCURRENTLY IF EXISTS idx_directory_entity_fqnhash_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_directory_entity_fqnhash_pattern
    ON directory_entity (fqnHash text_pattern_ops);
DROP INDEX CONCURRENTLY IF EXISTS idx_file_entity_fqnhash_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_file_entity_fqnhash_pattern
    ON file_entity (fqnHash text_pattern_ops);
DROP INDEX CONCURRENTLY IF EXISTS idx_spreadsheet_entity_fqnhash_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_spreadsheet_entity_fqnhash_pattern
    ON spreadsheet_entity (fqnHash text_pattern_ops);
DROP INDEX CONCURRENTLY IF EXISTS idx_worksheet_entity_fqnhash_pattern;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_worksheet_entity_fqnhash_pattern
    ON worksheet_entity (fqnHash text_pattern_ops);
