-- Add columns for configuration source tracking
ALTER TABLE openmetadata_settings
ADD COLUMN env_hash VARCHAR(64) NULL,
ADD COLUMN env_sync_timestamp TIMESTAMP NULL,
ADD COLUMN db_modified_timestamp TIMESTAMP NULL;
