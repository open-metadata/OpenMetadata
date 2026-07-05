-- Post data migration script for Task System Redesign - OpenMetadata 2.0.0
-- This script runs after the data migration completes

-- =====================================================
-- NOTE: Suggestion migration (suggestions → task_entity),
-- thread-based task migration (thread_entity → task_entity),
-- and legacy system activity migration
-- (thread_entity generated feed rows → activity_stream)
-- are handled in Java MigrationUtil because they require
-- entity-link aware transformation logic.
-- =====================================================

-- =====================================================
-- PHASE 2D: Migrate announcements from thread_entity → announcement_entity
-- =====================================================

INSERT INTO announcement_entity (id, json, fqnhash)
SELECT
  json->>'id' AS id,
  jsonb_build_object(
    'id', json->>'id',
    'name', 'announcement-' || (json->>'id'),
    'fullyQualifiedName', 'announcement-' || (json->>'id'),
    'displayName', NULLIF(json->>'message', ''),
    'description', COALESCE(
      json->'announcement'->>'description',
      json->>'message',
      ''
    ),
    'entityLink', json->>'about',
    'startTime', (json->'announcement'->>'startTime')::bigint,
    'endTime', (json->'announcement'->>'endTime')::bigint,
    'status', CASE
                WHEN (json->'announcement'->>'endTime')::bigint < (extract(epoch from now()) * 1000)::bigint
                  THEN 'Expired'
                WHEN (json->'announcement'->>'startTime')::bigint > (extract(epoch from now()) * 1000)::bigint
                  THEN 'Scheduled'
                ELSE 'Active'
              END,
    'createdBy', json->>'createdBy',
    'updatedBy', COALESCE(json->>'updatedBy', json->>'createdBy'),
    'createdAt', (json->>'threadTs')::bigint,
    'updatedAt', COALESCE((json->>'updatedAt')::bigint, (json->>'threadTs')::bigint),
    'deleted', false,
    'version', 0.1,
    'reactions', COALESCE(json->'reactions', '[]'::jsonb)
  ) AS json,
  md5('announcement-' || (json->>'id')) AS fqnhash
FROM thread_entity t
WHERE json->>'type' = 'Announcement'
AND NOT EXISTS (
  SELECT 1 FROM announcement_entity a WHERE a.id = t.json->>'id'
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- PHASE 2E: Rename legacy thread storage to fail stale references
-- =====================================================
ALTER TABLE IF EXISTS thread_entity RENAME TO thread_entity_legacy;

-- =====================================================
-- PHASE 2F: Lower workflow trigger polling intervals
-- =====================================================
-- Reduce WorkflowEventConsumer poll interval from 10s to 1s.
-- The legacy 10s default added up to a 10s wait between an entity change and the
-- workflow-triggered approval task being created. On CI under resource pressure this
-- often drifted to >2 minutes when combined with Flowable's 60s async job poll. The
-- new value keeps the trigger pipeline near-real-time.
UPDATE event_subscription_entity
SET json = jsonb_set(json, '{pollInterval}', '1'::jsonb)
WHERE name = 'WorkflowEventConsumer'
  AND (json->>'pollInterval')::int > 1;

-- Lower Flowable async/timer job acquisition intervals to keep workflow-driven
-- task creation responsive. The previous 60s default was a Flowable production setting
-- carried over verbatim; for OpenMetadata's interactive task UX we want sub-second pickup.
UPDATE openmetadata_settings
SET json = jsonb_set(
             jsonb_set(json, '{executorConfiguration,asyncJobAcquisitionInterval}', '1000'::jsonb),
             '{executorConfiguration,timerJobAcquisitionInterval}', '5000'::jsonb)
WHERE configtype = 'workflowSettings'
  AND json->'executorConfiguration' IS NOT NULL
  AND ((json->'executorConfiguration'->>'asyncJobAcquisitionInterval')::int > 1000
    OR (json->'executorConfiguration'->>'timerJobAcquisitionInterval')::int > 5000);

-- pipelineStatuses is a derived field, read on demand from entity_extension_time_series, and is
-- now an array instead of a single object. Strip any stale single-object value that a GET->PUT
-- round-trip may have persisted into the stored entity JSON so it cannot break deserialization.
UPDATE ingestion_pipeline_entity
SET json = (json::jsonb #- '{pipelineStatuses}')::json
WHERE json::jsonb #> '{pipelineStatuses}' IS NOT NULL;

-- MCP Server and MCP Chat are no longer internal Applications; their enablement now lives in
-- platform settings (mcpConfiguration). The MCP Chat app was never shipped to customers, so
-- aiSettings.mcpChat keeps its seeded default shape (no config carry-over).

-- MCP Server: keep it disabled if the server app was not installed (mcpConfiguration defaults
-- to enabled=true, which would otherwise turn it on).
UPDATE openmetadata_settings
SET json = jsonb_set(json, '{enabled}', 'false'::jsonb)
WHERE configtype = 'mcpConfiguration'
  AND NOT EXISTS (SELECT 1 FROM installed_apps ia WHERE ia.name = 'McpApplication');

-- Retire the MCP apps (their Java classes and marketplace seeds are removed). Keep the bot users
-- so the MCP server keeps its principal.
DELETE FROM entity_relationship er USING installed_apps ia
  WHERE (er.fromId = ia.id OR er.toId = ia.id) AND ia.name IN ('McpApplication', 'McpChatApplication');
DELETE FROM entity_relationship er USING apps_marketplace ia
  WHERE (er.fromId = ia.id OR er.toId = ia.id) AND ia.name IN ('McpApplication', 'McpChatApplication');
DELETE FROM installed_apps WHERE name IN ('McpApplication', 'McpChatApplication');
DELETE FROM apps_marketplace WHERE name IN ('McpApplication', 'McpChatApplication');

-- Post data migration script for Task workflow cutover - OpenMetadata 2.0.0 (moved from 2.0.1)

-- RdfIndexApp: switch to weekly Saturday cron and full-rebuild every run.
-- Previous defaults (daily, incremental) were producing unbounded triple growth
-- because relationship-removal paths weren't fully reconciled. With per-run
-- CLEAR ALL the dataset always converges to MySQL state; weekly cadence keeps
-- per-run cost from saturating Fuseki.
--
-- Also rewrite `entities` to `["all"]`. Pre-upgrade, an operator could have
-- narrowed RDF indexing to a subset of entity types; the new recreateIndex=true
-- semantics issues a CLEAR ALL before indexing, which would otherwise wipe
-- triples for entity types still in MySQL but missing from the subset list.
-- Forcing the subset list back to `["all"]` ensures the post-CLEAR-ALL run
-- repopulates the graph fully; operators can re-narrow after the migration if
-- they need partial indexing.
UPDATE installed_apps
SET json = jsonb_set(
    jsonb_set(
        jsonb_set(json::jsonb, '{appConfiguration,recreateIndex}', 'true'),
        '{appSchedule,cronExpression}',
        '"0 0 * * 6"'
    ),
    '{appConfiguration,entities}',
    '["all"]'::jsonb
)
WHERE name = 'RdfIndexApp';

UPDATE apps_marketplace
SET json = jsonb_set(json::jsonb, '{appConfiguration,recreateIndex}', 'true')
WHERE name = 'RdfIndexApp';

-- Backfill policyAgentConfig defaults on existing Snowflake services. The schema-level
-- defaults in snowflakeConnection.json only apply at create-time deserialization; rows
-- already persisted carry the previous all-false shape and won't pick up the new defaults
-- without this rewrite. Only fields that are currently false are flipped — any operator-set
-- true value is preserved.
UPDATE dbservice_entity
SET json = jsonb_set(
    json::jsonb,
    '{connection,config,policyAgentConfig,enabled}',
    to_jsonb(true)
)
WHERE serviceType = 'Snowflake'
  AND json::jsonb #> '{connection,config,policyAgentConfig,enabled}' = 'false'::jsonb;

UPDATE dbservice_entity
SET json = jsonb_set(
    json::jsonb,
    '{connection,config,policyAgentConfig,supportsFullAccess}',
    to_jsonb(true)
)
WHERE serviceType = 'Snowflake'
  AND json::jsonb #> '{connection,config,policyAgentConfig,supportsFullAccess}' = 'false'::jsonb;

UPDATE dbservice_entity
SET json = jsonb_set(
    json::jsonb,
    '{connection,config,policyAgentConfig,supportsMaskedAccess}',
    to_jsonb(true)
)
WHERE serviceType = 'Snowflake'
  AND json::jsonb #> '{connection,config,policyAgentConfig,supportsMaskedAccess}' = 'false'::jsonb;

-- Services that pre-date the policyAgentConfig field entirely (older rows where the whole
-- object is missing) — write the full block in one shot. `jsonb_set(..., true)` creates the
-- key if absent.
UPDATE dbservice_entity
SET json = jsonb_set(
    json::jsonb,
    '{connection,config,policyAgentConfig}',
    '{"enabled":true,"supportsColumnAccess":false,"supportsFullAccess":true,"supportsMaskedAccess":true}'::jsonb,
    true
)
WHERE serviceType = 'Snowflake'
  AND json::jsonb #> '{connection,config,policyAgentConfig}' IS NULL;

-- Databricks: enabled/Full default to true, Column and Masked stay false.
-- Two guarded flips + one full-object write for legacy rows.
UPDATE dbservice_entity
SET json = jsonb_set(
    json::jsonb,
    '{connection,config,policyAgentConfig,enabled}',
    to_jsonb(true)
)
WHERE serviceType = 'Databricks'
  AND json::jsonb #> '{connection,config,policyAgentConfig,enabled}' = 'false'::jsonb;

UPDATE dbservice_entity
SET json = jsonb_set(
    json::jsonb,
    '{connection,config,policyAgentConfig,supportsFullAccess}',
    to_jsonb(true)
)
WHERE serviceType = 'Databricks'
  AND json::jsonb #> '{connection,config,policyAgentConfig,supportsFullAccess}' = 'false'::jsonb;

UPDATE dbservice_entity
SET json = jsonb_set(
    json::jsonb,
    '{connection,config,policyAgentConfig}',
    '{"enabled":true,"supportsColumnAccess":false,"supportsFullAccess":true,"supportsMaskedAccess":false}'::jsonb,
    true
)
WHERE serviceType = 'Databricks'
  AND json::jsonb #> '{connection,config,policyAgentConfig}' IS NULL;

-- Corrective heal for instances that already ran the earlier version of this script.
-- Earlier the Databricks block forced supportsMaskedAccess to true; the intended
-- default is false. Reset it on every Databricks row that currently has it true.
UPDATE dbservice_entity
SET json = jsonb_set(
    json::jsonb,
    '{connection,config,policyAgentConfig,supportsMaskedAccess}',
    to_jsonb(false)
)
WHERE serviceType = 'Databricks'
  AND json::jsonb #> '{connection,config,policyAgentConfig,supportsMaskedAccess}' = 'true'::jsonb;

-- Postgres no longer declares policyAgentConfig. Earlier this script backfilled the
-- object onto Postgres rows; remove it so the stored shape matches the schema.
UPDATE dbservice_entity
SET json = (json::jsonb #- '{connection,config,policyAgentConfig}')
WHERE serviceType = 'Postgres'
  AND json::jsonb #> '{connection,config,policyAgentConfig}' IS NOT NULL;
