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
