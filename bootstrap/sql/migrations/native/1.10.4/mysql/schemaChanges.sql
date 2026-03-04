-- Delete searchSettings to force reload from packaged searchSettings.json with field-based aggregations
DELETE FROM openmetadata_settings WHERE configType='searchSettings';