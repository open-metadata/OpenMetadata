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

CREATE TABLE IF NOT EXISTS security_service_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    nameHash VARCHAR(256) NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    serviceType VARCHAR(256) GENERATED ALWAYS AS (json ->> 'serviceType') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt') :: bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted') :: boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (name)
);