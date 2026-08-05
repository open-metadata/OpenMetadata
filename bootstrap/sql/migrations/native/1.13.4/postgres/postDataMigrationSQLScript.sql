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
