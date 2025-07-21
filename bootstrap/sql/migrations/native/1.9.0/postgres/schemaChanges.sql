-- Create Drive Service entity table
CREATE TABLE IF NOT EXISTS drive_service_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    nameHash VARCHAR(256) NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    serviceType VARCHAR(256) GENERATED ALWAYS AS (json ->> 'serviceType') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (nameHash)
);

CREATE INDEX IF NOT EXISTS idx_drive_service_name ON drive_service_entity (name);

-- Create Directory entity table
CREATE TABLE IF NOT EXISTS directory_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    fullyQualifiedName VARCHAR(768) GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

CREATE INDEX IF NOT EXISTS idx_directory_name ON directory_entity (name);
CREATE INDEX IF NOT EXISTS idx_directory_fqn ON directory_entity (fullyQualifiedName);
CREATE INDEX IF NOT EXISTS idx_directory_deleted ON directory_entity (deleted);

-- Create File entity table
CREATE TABLE IF NOT EXISTS file_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    fullyQualifiedName VARCHAR(768) GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED NOT NULL,
    fileType VARCHAR(256) GENERATED ALWAYS AS (json ->> 'fileType') STORED,
    directoryFqn VARCHAR(768) GENERATED ALWAYS AS (json -> 'directory' ->> 'fullyQualifiedName') STORED,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

CREATE INDEX IF NOT EXISTS idx_file_name ON file_entity (name);
CREATE INDEX IF NOT EXISTS idx_file_fqn ON file_entity (fullyQualifiedName);
CREATE INDEX IF NOT EXISTS idx_file_deleted ON file_entity (deleted);
CREATE INDEX IF NOT EXISTS idx_file_filetype ON file_entity (fileType);
CREATE INDEX IF NOT EXISTS idx_file_directory_fqn ON file_entity (directoryFqn);

-- Create Spreadsheet entity table
CREATE TABLE IF NOT EXISTS spreadsheet_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    fullyQualifiedName VARCHAR(768) GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED NOT NULL,
    directoryFqn VARCHAR(768) GENERATED ALWAYS AS (json -> 'directory' ->> 'fullyQualifiedName') STORED,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

CREATE INDEX IF NOT EXISTS idx_spreadsheet_name ON spreadsheet_entity (name);
CREATE INDEX IF NOT EXISTS idx_spreadsheet_fqn ON spreadsheet_entity (fullyQualifiedName);
CREATE INDEX IF NOT EXISTS idx_spreadsheet_deleted ON spreadsheet_entity (deleted);
CREATE INDEX IF NOT EXISTS idx_spreadsheet_directory_fqn ON spreadsheet_entity (directoryFqn);

-- Create Worksheet entity table
CREATE TABLE IF NOT EXISTS worksheet_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    fullyQualifiedName VARCHAR(768) GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED NOT NULL,
    spreadsheetFqn VARCHAR(768) GENERATED ALWAYS AS (json -> 'spreadsheet' ->> 'fullyQualifiedName') STORED,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

CREATE INDEX IF NOT EXISTS idx_worksheet_name ON worksheet_entity (name);
CREATE INDEX IF NOT EXISTS idx_worksheet_fqn ON worksheet_entity (fullyQualifiedName);
CREATE INDEX IF NOT EXISTS idx_worksheet_deleted ON worksheet_entity (deleted);
CREATE INDEX IF NOT EXISTS idx_worksheet_spreadsheet_fqn ON worksheet_entity (spreadsheetFqn);

-- Add performance indexes for common queries
CREATE INDEX IF NOT EXISTS idx_directory_service ON directory_entity ((json -> 'service' ->> 'id'));
CREATE INDEX IF NOT EXISTS idx_file_directory ON file_entity ((json -> 'directory' ->> 'id'));
CREATE INDEX IF NOT EXISTS idx_spreadsheet_directory ON spreadsheet_entity ((json -> 'directory' ->> 'id'));
CREATE INDEX IF NOT EXISTS idx_worksheet_spreadsheet ON worksheet_entity ((json -> 'spreadsheet' ->> 'id'));

-- Performance optimization indexes for entity_relationship table
-- These indexes improve cascade deletion performance
CREATE INDEX IF NOT EXISTS idx_entity_rel_from_delete 
ON entity_relationship(fromid, fromentity, toid, toentity, relation);

CREATE INDEX IF NOT EXISTS idx_entity_rel_to_delete 
ON entity_relationship(toid, toentity, fromid, fromentity, relation);

-- Index for cascade queries (CONTAINS and PARENT_OF relationships only)
-- PostgreSQL supports partial indexes
CREATE INDEX IF NOT EXISTS idx_entity_rel_cascade 
ON entity_relationship(fromid, relation, toentity, toid)
WHERE relation IN (0, 8);

-- Entity deletion lock table for preventing orphaned entities during cascade deletion
CREATE TABLE IF NOT EXISTS entity_deletion_lock (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    entityId UUID NOT NULL,
    entityType VARCHAR(256) NOT NULL,
    entityFqn VARCHAR(2048) NOT NULL,
    lockType VARCHAR(50) NOT NULL, -- 'DELETE_IN_PROGRESS', 'DELETE_SCHEDULED'
    lockedBy VARCHAR(256) NOT NULL,
    lockedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expectedCompletion TIMESTAMP NULL,
    deletionScope VARCHAR(50), -- 'ENTITY_ONLY', 'CASCADE'
    metadata JSONB,
    PRIMARY KEY (id),
    UNIQUE (entityId, entityType)
);

-- Create indexes for deletion lock table
-- Use btree index for entityFqn prefix matching
CREATE INDEX IF NOT EXISTS idx_deletion_lock_fqn ON entity_deletion_lock(entityFqn);
CREATE INDEX IF NOT EXISTS idx_deletion_lock_time ON entity_deletion_lock(lockedAt);

-- Update columnValuesToBeInSet test definition to include BOOLEAN in supportedDataTypes and update parameterDefinition
UPDATE test_definition
  SET json = jsonb_set(json, '{supportedDataTypes}', '["NUMBER", "INT", "FLOAT", "DOUBLE", "DECIMAL", "TINYINT", "SMALLINT", "BIGINT", "BYTEINT", "BYTES", "STRING", "MEDIUMTEXT", "TEXT", "CHAR", "VARCHAR", "BOOLEAN"]'::jsonb)
WHERE name in ('columnValuesToBeInSet', 'columnValuesToBeNotInSet');