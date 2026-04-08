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

-- table_entity: build profileSampleConfig from existing flat fields (skip if already migrated)
UPDATE table_entity
SET json = jsonb_set(
    json::jsonb,
    '{tableProfilerConfig,profileSampleConfig}',
    jsonb_build_object(
        'enabled', true,
        'sampleConfigType', 'STATIC',
        'config', jsonb_build_object(
            'profileSample', json::jsonb #> '{tableProfilerConfig,profileSample}',
            'profileSampleType', COALESCE(
                json::jsonb #> '{tableProfilerConfig,profileSampleType}',
                '"PERCENTAGE"'::jsonb
            ),
            'samplingMethodType', json::jsonb #> '{tableProfilerConfig,samplingMethodType}'
        )
    )
)::json
WHERE json::jsonb #>> '{tableProfilerConfig,profileSample}' IS NOT NULL
  AND json::jsonb #> '{tableProfilerConfig,profileSampleConfig}' IS NULL;

-- table_entity: remove old flat fields
UPDATE table_entity
SET json = (json::jsonb #- '{tableProfilerConfig,profileSample}'
                        #- '{tableProfilerConfig,profileSampleType}'
                        #- '{tableProfilerConfig,samplingMethodType}')::json
WHERE json::jsonb #>> '{tableProfilerConfig,profileSample}' IS NOT NULL
   OR json::jsonb #>> '{tableProfilerConfig,profileSampleType}' IS NOT NULL
   OR json::jsonb #>> '{tableProfilerConfig,samplingMethodType}' IS NOT NULL;

-- database_entity: build profileSampleConfig from existing flat fields (skip if already migrated)
UPDATE database_entity
SET json = jsonb_set(
    json::jsonb,
    '{databaseProfilerConfig,profileSampleConfig}',
    jsonb_build_object(
        'enabled', true,
        'sampleConfigType', 'STATIC',
        'config', jsonb_build_object(
            'profileSample', json::jsonb #> '{databaseProfilerConfig,profileSample}',
            'profileSampleType', COALESCE(
                json::jsonb #> '{databaseProfilerConfig,profileSampleType}',
                '"PERCENTAGE"'::jsonb
            ),
            'samplingMethodType', json::jsonb #> '{databaseProfilerConfig,samplingMethodType}'
        )
    )
)::json
WHERE json::jsonb #>> '{databaseProfilerConfig,profileSample}' IS NOT NULL
  AND json::jsonb #> '{databaseProfilerConfig,profileSampleConfig}' IS NULL;

-- database_entity: remove old flat fields
UPDATE database_entity
SET json = (json::jsonb #- '{databaseProfilerConfig,profileSample}'
                        #- '{databaseProfilerConfig,profileSampleType}'
                        #- '{databaseProfilerConfig,samplingMethodType}')::json
WHERE json::jsonb #>> '{databaseProfilerConfig,profileSample}' IS NOT NULL
   OR json::jsonb #>> '{databaseProfilerConfig,profileSampleType}' IS NOT NULL
   OR json::jsonb #>> '{databaseProfilerConfig,samplingMethodType}' IS NOT NULL;

-- database_schema_entity: build profileSampleConfig from existing flat fields (skip if already migrated)
UPDATE database_schema_entity
SET json = jsonb_set(
    json::jsonb,
    '{databaseSchemaProfilerConfig,profileSampleConfig}',
    jsonb_build_object(
        'enabled', true,
        'sampleConfigType', 'STATIC',
        'config', jsonb_build_object(
            'profileSample', json::jsonb #> '{databaseSchemaProfilerConfig,profileSample}',
            'profileSampleType', COALESCE(
                json::jsonb #> '{databaseSchemaProfilerConfig,profileSampleType}',
                '"PERCENTAGE"'::jsonb
            ),
            'samplingMethodType', json::jsonb #> '{databaseSchemaProfilerConfig,samplingMethodType}'
        )
    )
)::json
WHERE json::jsonb #>> '{databaseSchemaProfilerConfig,profileSample}' IS NOT NULL
  AND json::jsonb #> '{databaseSchemaProfilerConfig,profileSampleConfig}' IS NULL;

-- database_schema_entity: remove old flat fields
UPDATE database_schema_entity
SET json = (json::jsonb #- '{databaseSchemaProfilerConfig,profileSample}'
                        #- '{databaseSchemaProfilerConfig,profileSampleType}'
                        #- '{databaseSchemaProfilerConfig,samplingMethodType}')::json
WHERE json::jsonb #>> '{databaseSchemaProfilerConfig,profileSample}' IS NOT NULL
   OR json::jsonb #>> '{databaseSchemaProfilerConfig,profileSampleType}' IS NOT NULL
   OR json::jsonb #>> '{databaseSchemaProfilerConfig,samplingMethodType}' IS NOT NULL;

-- ingestion_pipeline_entity (profiler pipelines): build profileSampleConfig (skip if already migrated)
UPDATE ingestion_pipeline_entity
SET json = jsonb_set(
    json::jsonb,
    '{sourceConfig,config,profileSampleConfig}',
    jsonb_build_object(
        'enabled', true,
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
