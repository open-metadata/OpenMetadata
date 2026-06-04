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
SET json = JSON_SET(
    JSON_SET(
        json,
        '$.appConfiguration.recreateIndex', CAST('true' AS JSON),
        '$.appSchedule.cronExpression', '0 0 * * 6'
    ),
    '$.appConfiguration.entities', JSON_ARRAY('all')
)
WHERE name = 'RdfIndexApp';

UPDATE apps_marketplace
SET json = JSON_SET(json, '$.appConfiguration.recreateIndex', CAST('true' AS JSON))
WHERE name = 'RdfIndexApp';

-- Backfill policyAgentConfig defaults on existing Snowflake services. The schema-level
-- defaults in snowflakeConnection.json only apply at create-time deserialization; rows
-- already persisted carry the previous all-false shape and won't pick up the new defaults
-- without this rewrite. Only fields that are currently false are flipped — any operator-set
-- true value is preserved.
UPDATE dbservice_entity
SET json = JSON_SET(json, '$.connection.config.policyAgentConfig.enabled', true)
WHERE serviceType = 'Snowflake'
  AND JSON_EXTRACT(json, '$.connection.config.policyAgentConfig.enabled') = false;

UPDATE dbservice_entity
SET json = JSON_SET(json, '$.connection.config.policyAgentConfig.supportsFullAccess', true)
WHERE serviceType = 'Snowflake'
  AND JSON_EXTRACT(json, '$.connection.config.policyAgentConfig.supportsFullAccess') = false;

UPDATE dbservice_entity
SET json = JSON_SET(json, '$.connection.config.policyAgentConfig.supportsMaskedAccess', true)
WHERE serviceType = 'Snowflake'
  AND JSON_EXTRACT(json, '$.connection.config.policyAgentConfig.supportsMaskedAccess') = false;

-- Services that pre-date the policyAgentConfig field entirely (older rows where the whole
-- object is missing) — write the full block in one shot. JSON_SET creates the key path.
UPDATE dbservice_entity
SET json = JSON_SET(
    json,
    '$.connection.config.policyAgentConfig',
    JSON_OBJECT(
        'enabled', true,
        'supportsColumnAccess', false,
        'supportsFullAccess', true,
        'supportsMaskedAccess', true
    )
)
WHERE serviceType = 'Snowflake'
  AND JSON_EXTRACT(json, '$.connection.config.policyAgentConfig') IS NULL;

-- Databricks: enabled/Full default to true, Column and Masked stay false.
-- Two guarded flips + one full-object write for legacy rows.
UPDATE dbservice_entity
SET json = JSON_SET(json, '$.connection.config.policyAgentConfig.enabled', true)
WHERE serviceType = 'Databricks'
  AND JSON_EXTRACT(json, '$.connection.config.policyAgentConfig.enabled') = false;

UPDATE dbservice_entity
SET json = JSON_SET(json, '$.connection.config.policyAgentConfig.supportsFullAccess', true)
WHERE serviceType = 'Databricks'
  AND JSON_EXTRACT(json, '$.connection.config.policyAgentConfig.supportsFullAccess') = false;

UPDATE dbservice_entity
SET json = JSON_SET(
    json,
    '$.connection.config.policyAgentConfig',
    JSON_OBJECT(
        'enabled', true,
        'supportsColumnAccess', false,
        'supportsFullAccess', true,
        'supportsMaskedAccess', false
    )
)
WHERE serviceType = 'Databricks'
  AND JSON_EXTRACT(json, '$.connection.config.policyAgentConfig') IS NULL;

-- Corrective heal for instances that already ran the earlier version of this script.
-- Earlier the Databricks block forced supportsMaskedAccess to true; the intended
-- default is false. Reset it on every Databricks row that currently has it true.
UPDATE dbservice_entity
SET json = JSON_SET(json, '$.connection.config.policyAgentConfig.supportsMaskedAccess', false)
WHERE serviceType = 'Databricks'
  AND JSON_EXTRACT(json, '$.connection.config.policyAgentConfig.supportsMaskedAccess') = true;

-- Postgres no longer declares policyAgentConfig. Earlier this script backfilled the
-- object onto Postgres rows; remove it so the stored shape matches the schema.
UPDATE dbservice_entity
SET json = JSON_REMOVE(json, '$.connection.config.policyAgentConfig')
WHERE serviceType = 'Postgres'
  AND JSON_EXTRACT(json, '$.connection.config.policyAgentConfig') IS NOT NULL;
