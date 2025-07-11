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
-- Migrate domain to domains in all entity tables that had singular domain
-- Using the correct table names from existing migrations
UPDATE api_collection_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE api_endpoint_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE api_service_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE chart_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE dashboard_data_model_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE dashboard_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE dashboard_service_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE database_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE database_schema_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE dbservice_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE glossary_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE glossary_term_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE ingestion_pipeline_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE messaging_service_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE metadata_service_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE metric_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE ml_model_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE mlmodel_service_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE persona_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE pipeline_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE pipeline_service_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE query_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE report_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE search_index_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE search_service_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE storage_container_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE storage_service_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE stored_procedure_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE table_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;
UPDATE topic_entity SET json = jsonb_set(json - 'domain', '{domains}', jsonb_build_array(json->'domain')) WHERE json->'domain' IS NOT NULL;

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
-- Note: user_entity and team_entity already had domains array, so they are not migrated

-- Clean old test connections
TRUNCATE automations_workflow;