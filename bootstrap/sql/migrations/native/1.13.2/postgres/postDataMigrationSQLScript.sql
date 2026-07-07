-- Security: openMetadataServerConnection (app bot JWT) and privateConfiguration (external
-- tokens/passwords) are runtime-only fields, re-injected on demand by
-- ApplicationHandler.setAppRuntimeProperties. They were previously persisted onto app rows
-- and version snapshots and served in API responses. Strip them from stored data so the
-- secrets no longer linger at rest.
UPDATE installed_apps
SET json = (json::jsonb - 'openMetadataServerConnection' - 'privateConfiguration')
WHERE jsonb_exists(json::jsonb, 'openMetadataServerConnection')
   OR jsonb_exists(json::jsonb, 'privateConfiguration');

UPDATE entity_extension
SET json = (json::jsonb - 'openMetadataServerConnection' - 'privateConfiguration')
WHERE extension LIKE 'app.version.%'
  AND (jsonb_exists(json::jsonb, 'openMetadataServerConnection')
       OR jsonb_exists(json::jsonb, 'privateConfiguration'));
