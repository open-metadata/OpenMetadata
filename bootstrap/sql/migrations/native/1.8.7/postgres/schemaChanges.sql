-- Create table for tracking index mapping versions
CREATE TABLE IF NOT EXISTS index_mapping_versions (
    entityType VARCHAR(256) NOT NULL,
    mappingHash VARCHAR(32) NOT NULL,
    mappingJson JSONB NOT NULL,
    version VARCHAR(36) NOT NULL,
    updatedAt BIGINT NOT NULL,
    updatedBy VARCHAR(256) NOT NULL,
    PRIMARY KEY (entityType)
);

CREATE INDEX IF NOT EXISTS idx_index_mapping_versions_version ON index_mapping_versions (version);
CREATE INDEX IF NOT EXISTS idx_index_mapping_versions_updatedAt ON index_mapping_versions (updatedAt);

-- remove old reset link email template
DELETE from doc_store where name = 'reset-link' and entityType = 'EmailTemplate';

-- In case 1.7.3 migrations executed , with --force , remove it from server_logs as it is covered in this migration
DELETE FROM SERVER_CHANGE_LOG WHERE version = '1.7.3';

-- Update ingestion pipeline configurations to set markDeletedSchemas and markDeletedDatabases to false
UPDATE ingestion_pipeline_entity
SET json = jsonb_set(
    jsonb_set(json::jsonb, '{sourceConfig,config,markDeletedSchemas}', 'false'::jsonb),
    '{sourceConfig,config,markDeletedDatabases}', 'false'::jsonb
)::json
WHERE json::jsonb -> 'sourceConfig' -> 'config' ->> 'type' = 'DatabaseMetadata';
