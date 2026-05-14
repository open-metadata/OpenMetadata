-- Post data migration script for Task workflow cutover - OpenMetadata 2.0.1

-- RdfIndexApp: switch to weekly Saturday cron and recreate-on-each-run.
-- Previous defaults (daily, incremental) were producing unbounded triple growth
-- because relationship-removal paths weren't fully reconciled. With per-run
-- CLEAR ALL the dataset always converges to the current MySQL state; weekly
-- cadence keeps the per-run cost from saturating Fuseki.
UPDATE installed_apps
SET json = JSON_SET(
    json,
    '$.appConfiguration.recreateIndex', CAST('true' AS JSON),
    '$.appSchedule.cronExpression', '0 0 * * 6'
)
WHERE name = 'RdfIndexApp';

UPDATE apps_marketplace
SET json = JSON_SET(json, '$.appConfiguration.recreateIndex', CAST('true' AS JSON))
WHERE name = 'RdfIndexApp';
