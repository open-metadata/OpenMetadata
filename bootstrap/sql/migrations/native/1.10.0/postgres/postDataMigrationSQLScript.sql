-- Migration script to restructure Databricks connection configuration
-- Move 'token' field from connection.config.token to connection.config.authType.token

UPDATE dbservice_entity
SET json = jsonb_set(
    json #- '{connection,config,token}',
    '{connection,config,authType}',
    jsonb_build_object('token', json #> '{connection,config,token}'),
    true
)
WHERE serviceType in ('Databricks', 'UnityCatalog')
    AND jsonb_exists(json -> 'connection' -> 'config', 'token');

-- Migration to remove .png extension from appScreenshots in apps tables
-- Part of fixing appScreenshots extension handling change

-- Update apps_marketplace table - remove .png extension from appScreenshots only
UPDATE apps_marketplace 
SET json = jsonb_set(
    json,
    '{appScreenshots}',
    REPLACE((json -> 'appScreenshots')::text, '.png"', '"')::jsonb
)
WHERE json IS NOT NULL
  AND json -> 'appScreenshots' IS NOT NULL
  AND jsonb_array_length(json -> 'appScreenshots') > 0
  AND (json -> 'appScreenshots')::text LIKE '%.png%';

-- Update installed_apps table - remove .png extension from appScreenshots only
UPDATE installed_apps 
SET json = jsonb_set(
    json,
    '{appScreenshots}',
    REPLACE((json -> 'appScreenshots')::text, '.png"', '"')::jsonb
)
WHERE json IS NOT NULL
  AND json -> 'appScreenshots' IS NOT NULL
  AND jsonb_array_length(json -> 'appScreenshots') > 0
  AND (json -> 'appScreenshots')::text LIKE '%.png%';

-- Update apps_data_store table - remove .png extension from appScreenshots only
UPDATE apps_data_store 
SET json = jsonb_set(
    json::jsonb,
    '{appScreenshots}',
    REPLACE((json -> 'appScreenshots')::text, '.png"', '"')::jsonb
)
WHERE json IS NOT NULL
  AND json -> 'appScreenshots' IS NOT NULL
  AND json_array_length((json -> 'appScreenshots')::json) > 0
  AND (json -> 'appScreenshots')::text LIKE '%.png%';
