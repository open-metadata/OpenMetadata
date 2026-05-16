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
