-- Add columns for configuration source tracking
ALTER TABLE openmetadata_settings
ADD COLUMN env_hash VARCHAR(64) NULL,
ADD COLUMN env_sync_timestamp TIMESTAMP(6) NULL,
ADD COLUMN db_modified_timestamp TIMESTAMP(6) NULL;

-- Set initial timestamps for existing records
UPDATE openmetadata_settings
SET db_modified_timestamp = CURRENT_TIMESTAMP(6)
WHERE db_modified_timestamp IS NULL;
