-- remove openMetadataUrl from smtpSettings
UPDATE openmetadata_settings
SET json = JSON_REMOVE(json, '$.openMetadataUrl')
WHERE configType = 'emailConfiguration';