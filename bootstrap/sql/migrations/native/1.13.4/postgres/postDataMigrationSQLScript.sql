-- MCP configuration lives solely in the mcpConfiguration setting. Drop the app-level copy, which
-- no code reads, and hide the now empty configure step.
UPDATE installed_apps
SET json = jsonb_set(json::jsonb - 'appConfiguration', '{allowConfiguration}', 'false'::jsonb)
WHERE name = 'McpApplication';

UPDATE apps_marketplace
SET json = jsonb_set(json::jsonb - 'appConfiguration', '{allowConfiguration}', 'false'::jsonb)
WHERE name = 'McpApplication';

UPDATE entity_extension
SET json = jsonb_set(json::jsonb - 'appConfiguration', '{allowConfiguration}', 'false'::jsonb)
WHERE extension LIKE 'app.version.%'
  AND json::jsonb ->> 'name' = 'McpApplication';

-- Remove page related-entity relationships that point at a column. 'tableColumn' is a
-- search-only pseudo-type with no repository, so resolving such a related-entity row throws
-- "Entity repository for tableColumn not found" and 404s the Context Center list.
-- page relatedEntities are stored as HAS (relation 10).
DELETE FROM entity_relationship
WHERE fromEntity = 'tableColumn'
  AND toEntity = 'page'
  AND relation = 10;

UPDATE event_subscription_entity
SET json = jsonb_set(json, '{pollInterval}', '1'::jsonb)
WHERE name = 'WorkflowEventConsumer'
  AND (json->>'pollInterval')::int > 1;

-- Restore faster Flowable job-acquisition on 1.13.
-- The 1.10.5 migration set asyncJobAcquisitionInterval/timerJobAcquisitionInterval to 60000 to
-- reduce perceived idle polling, but 60s pickup starves the workflow engine under load: the
-- governance change-event consumer backlogs by minutes and approval chains time out (2.0, which
-- polls at 1000, passes). 2.0.0 reset these to 1000/5000. On 1.13 we use 10000/5000 instead: fast
-- enough to keep approvals moving, but polling the DB less aggressively than 2.0's 1s. The acquire
-- query is a bounded indexed lookup. Idempotent: only lowers values still above target.
UPDATE openmetadata_settings
SET json = jsonb_set(
             jsonb_set(json, '{executorConfiguration,asyncJobAcquisitionInterval}', '10000'::jsonb),
             '{executorConfiguration,timerJobAcquisitionInterval}', '5000'::jsonb)
WHERE configtype = 'workflowSettings'
  AND json->'executorConfiguration' IS NOT NULL
  AND ((json->'executorConfiguration'->>'asyncJobAcquisitionInterval')::int > 10000
    OR (json->'executorConfiguration'->>'timerJobAcquisitionInterval')::int > 5000);

-- Drop data product ports pointing at a column ('tableColumn' has no repository, so it 500s
-- portsView). relation 23 = INPUT_PORT, 24 = OUTPUT_PORT.
DELETE FROM entity_relationship
WHERE fromEntity = 'dataProduct'
  AND toEntity = 'tableColumn'
  AND relation IN (23, 24);

-- Offer Table Diff on Databricks, Unity Catalog and AzureSQL.
-- tableDiff.json gained these three services, but test definitions are seed data and
-- initializeEntity() skips a row that already exists, so an upgraded deployment keeps the old
-- 10-service list and the Add Test form never offers Table Diff on those connectors.
-- One statement per service so a customised list keeps its other entries, and each is a no-op
-- once its service is present. An empty list already means "every service", so leave it alone
-- rather than narrowing it to three.
UPDATE test_definition
SET json = jsonb_set(json, '{supportedServices}',
                     (json->'supportedServices') || '["Databricks"]'::jsonb)
WHERE name = 'tableDiff'
  AND jsonb_typeof(json->'supportedServices') = 'array'
  AND jsonb_array_length(json->'supportedServices') > 0
  AND NOT (json->'supportedServices') @> '["Databricks"]'::jsonb;

UPDATE test_definition
SET json = jsonb_set(json, '{supportedServices}',
                     (json->'supportedServices') || '["UnityCatalog"]'::jsonb)
WHERE name = 'tableDiff'
  AND jsonb_typeof(json->'supportedServices') = 'array'
  AND jsonb_array_length(json->'supportedServices') > 0
  AND NOT (json->'supportedServices') @> '["UnityCatalog"]'::jsonb;

UPDATE test_definition
SET json = jsonb_set(json, '{supportedServices}',
                     (json->'supportedServices') || '["AzureSQL"]'::jsonb)
WHERE name = 'tableDiff'
  AND jsonb_typeof(json->'supportedServices') = 'array'
  AND jsonb_array_length(json->'supportedServices') > 0
  AND NOT (json->'supportedServices') @> '["AzureSQL"]'::jsonb;
