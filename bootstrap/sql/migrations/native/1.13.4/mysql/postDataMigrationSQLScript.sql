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
