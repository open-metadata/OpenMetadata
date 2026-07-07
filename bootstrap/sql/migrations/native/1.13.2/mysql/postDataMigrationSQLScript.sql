-- Security: openMetadataServerConnection (app bot JWT) and privateConfiguration (external
-- tokens/passwords) are runtime-only fields, re-injected on demand by
-- ApplicationHandler.setAppRuntimeProperties. They were previously persisted onto app rows
-- and version snapshots and served in API responses. Strip them from stored data so the
-- secrets no longer linger at rest.
UPDATE installed_apps
SET json = JSON_REMOVE(json, '$.openMetadataServerConnection', '$.privateConfiguration')
WHERE JSON_EXTRACT(json, '$.openMetadataServerConnection') IS NOT NULL
   OR JSON_EXTRACT(json, '$.privateConfiguration') IS NOT NULL;

UPDATE entity_extension
SET json = JSON_REMOVE(json, '$.openMetadataServerConnection', '$.privateConfiguration')
WHERE extension LIKE 'app.version.%'
  AND (JSON_EXTRACT(json, '$.openMetadataServerConnection') IS NOT NULL
       OR JSON_EXTRACT(json, '$.privateConfiguration') IS NOT NULL);
