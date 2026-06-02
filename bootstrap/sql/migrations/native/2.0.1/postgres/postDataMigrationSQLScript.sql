-- Post data migration script for Task workflow cutover - OpenMetadata 2.0.1

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
