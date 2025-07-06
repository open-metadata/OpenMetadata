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
    fqnHash VARCHAR(768) NOT NULL,
    fullyQualifiedName VARCHAR(768) GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

CREATE INDEX IF NOT EXISTS idx_directory_fqn ON directory_entity (fullyQualifiedName);
CREATE INDEX IF NOT EXISTS idx_directory_deleted ON directory_entity (deleted);

-- Create File entity table
CREATE TABLE IF NOT EXISTS file_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    fullyQualifiedName VARCHAR(768) GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

CREATE INDEX IF NOT EXISTS idx_file_fqn ON file_entity (fullyQualifiedName);
CREATE INDEX IF NOT EXISTS idx_file_deleted ON file_entity (deleted);

-- Create Spreadsheet entity table
CREATE TABLE IF NOT EXISTS spreadsheet_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    fullyQualifiedName VARCHAR(768) GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

CREATE INDEX IF NOT EXISTS idx_spreadsheet_fqn ON spreadsheet_entity (fullyQualifiedName);
CREATE INDEX IF NOT EXISTS idx_spreadsheet_deleted ON spreadsheet_entity (deleted);

-- Create Worksheet entity table
CREATE TABLE IF NOT EXISTS worksheet_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    fqnHash VARCHAR(768) NOT NULL,
    fullyQualifiedName VARCHAR(768) GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

CREATE INDEX IF NOT EXISTS idx_worksheet_fqn ON worksheet_entity (fullyQualifiedName);
CREATE INDEX IF NOT EXISTS idx_worksheet_deleted ON worksheet_entity (deleted);

-- Add performance indexes for common queries
CREATE INDEX IF NOT EXISTS idx_directory_service ON directory_entity ((json -> 'service' ->> 'id'));
CREATE INDEX IF NOT EXISTS idx_file_directory ON file_entity ((json -> 'directory' ->> 'id'));
CREATE INDEX IF NOT EXISTS idx_spreadsheet_directory ON spreadsheet_entity ((json -> 'directory' ->> 'id'));
CREATE INDEX IF NOT EXISTS idx_worksheet_spreadsheet ON worksheet_entity ((json -> 'spreadsheet' ->> 'id'));