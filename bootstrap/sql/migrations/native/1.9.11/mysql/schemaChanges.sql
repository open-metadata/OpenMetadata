-- Add migrations to fetch updated searchSettings
DELETE FROM openmetadata_settings
WHERE
    configType = 'searchSettings';