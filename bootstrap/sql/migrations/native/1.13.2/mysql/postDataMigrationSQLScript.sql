-- Remove runtime-only fields (openMetadataServerConnection, privateConfiguration) from stored application data.
UPDATE installed_apps
SET json = JSON_REMOVE(json, '$.openMetadataServerConnection', '$.privateConfiguration')
WHERE JSON_EXTRACT(json, '$.openMetadataServerConnection') IS NOT NULL
   OR JSON_EXTRACT(json, '$.privateConfiguration') IS NOT NULL;

UPDATE entity_extension
SET json = JSON_REMOVE(json, '$.openMetadataServerConnection', '$.privateConfiguration')
WHERE extension LIKE 'app.version.%'
  AND (JSON_EXTRACT(json, '$.openMetadataServerConnection') IS NOT NULL
       OR JSON_EXTRACT(json, '$.privateConfiguration') IS NOT NULL);
