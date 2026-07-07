-- Remove runtime-only fields (openMetadataServerConnection, privateConfiguration) from stored application data.
UPDATE installed_apps
SET json = (json::jsonb - 'openMetadataServerConnection' - 'privateConfiguration')
WHERE jsonb_exists(json::jsonb, 'openMetadataServerConnection')
   OR jsonb_exists(json::jsonb, 'privateConfiguration');

UPDATE entity_extension
SET json = (json::jsonb - 'openMetadataServerConnection' - 'privateConfiguration')
WHERE extension LIKE 'app.version.%'
  AND (jsonb_exists(json::jsonb, 'openMetadataServerConnection')
       OR jsonb_exists(json::jsonb, 'privateConfiguration'));
