-- Set initial timestamps for existing records
UPDATE openmetadata_settings
SET db_modified_timestamp = CURRENT_TIMESTAMP(6)
WHERE db_modified_timestamp IS NULL;
