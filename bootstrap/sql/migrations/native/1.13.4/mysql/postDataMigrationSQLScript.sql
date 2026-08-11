-- MCP configuration lives solely in the mcpConfiguration setting. Drop the app-level copy, which
-- no code reads, and hide the now empty configure step.
UPDATE installed_apps
SET json = JSON_SET(JSON_REMOVE(json, '$.appConfiguration'), '$.allowConfiguration', CAST('false' AS JSON))
WHERE name = 'McpApplication';

UPDATE apps_marketplace
SET json = JSON_SET(JSON_REMOVE(json, '$.appConfiguration'), '$.allowConfiguration', CAST('false' AS JSON))
WHERE name = 'McpApplication';

UPDATE entity_extension
SET json = JSON_SET(JSON_REMOVE(json, '$.appConfiguration'), '$.allowConfiguration', CAST('false' AS JSON))
WHERE extension LIKE 'app.version.%'
  AND json->>'$.name' = 'McpApplication';

UPDATE event_subscription_entity
SET json = JSON_SET(json, '$.pollInterval', 1)
WHERE name = 'WorkflowEventConsumer'
  AND CAST(JSON_EXTRACT(json, '$.pollInterval') AS UNSIGNED) > 1;

-- Restore faster Flowable job-acquisition on 1.13.
-- The 1.10.5 migration set asyncJobAcquisitionInterval/timerJobAcquisitionInterval to 60000 to
-- reduce perceived idle polling, but 60s pickup starves the workflow engine under load: the
-- governance change-event consumer backlogs by minutes and approval chains time out (2.0, which
-- polls at 1000, passes). 2.0.0 reset these to 1000/5000. On 1.13 we use 10000/5000 instead: fast
-- enough to keep approvals moving, but polling the DB less aggressively than 2.0's 1s. The acquire
-- query is a bounded indexed lookup. Idempotent: only lowers values still above target.
UPDATE openmetadata_settings
SET json = JSON_SET(
             JSON_SET(json, '$.executorConfiguration.asyncJobAcquisitionInterval', 10000),
             '$.executorConfiguration.timerJobAcquisitionInterval', 5000)
WHERE configType = 'workflowSettings'
  AND JSON_EXTRACT(json, '$.executorConfiguration') IS NOT NULL
  AND (CAST(JSON_EXTRACT(json, '$.executorConfiguration.asyncJobAcquisitionInterval') AS UNSIGNED) > 10000
    OR CAST(JSON_EXTRACT(json, '$.executorConfiguration.timerJobAcquisitionInterval') AS UNSIGNED) > 5000);
