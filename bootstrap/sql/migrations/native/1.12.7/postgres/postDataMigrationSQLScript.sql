-- Set initial timestamps for existing records
UPDATE openmetadata_settings
SET db_modified_timestamp = CURRENT_TIMESTAMP
WHERE db_modified_timestamp IS NULL;
