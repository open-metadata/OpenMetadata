-- remove openMetadataUrl from smtpSettings
UPDATE openmetadata_settings
SET json = json - 'openMetadataUrl'
WHERE configType = 'emailConfiguration';