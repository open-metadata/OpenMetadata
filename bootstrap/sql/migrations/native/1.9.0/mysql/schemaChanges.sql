-- Drive Service Tables
CREATE TABLE IF NOT EXISTS drive_service_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.id'))) STORED NOT NULL,
    nameHash VARCHAR(256) NOT NULL COLLATE ascii_bin,
    name VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.name'))) VIRTUAL NOT NULL,
    serviceType VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.serviceType'))) VIRTUAL NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.updatedAt'))) VIRTUAL NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.updatedBy'))) VIRTUAL NOT NULL,
    deleted TINYINT(1) GENERATED ALWAYS AS (json_extract(json, '$.deleted')) VIRTUAL,
    PRIMARY KEY (id),
    UNIQUE KEY drive_service_entity_name_hash (nameHash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Directory Entity
CREATE TABLE IF NOT EXISTS directory_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.id'))) STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.name'))) VIRTUAL NOT NULL,
    fqnHash VARCHAR(768) NOT NULL COLLATE ascii_bin,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.updatedAt'))) VIRTUAL NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.updatedBy'))) VIRTUAL NOT NULL,
    deleted TINYINT(1) GENERATED ALWAYS AS (json_extract(json, '$.deleted')) VIRTUAL,
    PRIMARY KEY (id),
    UNIQUE KEY directory_entity_fqn_hash (fqnHash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
-- Migrate domain to domains in all entity tables that had singular domain
-- Using the correct table names from existing migrations
UPDATE api_collection_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE api_endpoint_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE api_service_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE chart_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE dashboard_data_model_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE dashboard_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE dashboard_service_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE database_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE database_schema_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE dbservice_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE glossary_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE glossary_term_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE ingestion_pipeline_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE messaging_service_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE metadata_service_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE metric_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE ml_model_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE mlmodel_service_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE persona_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE pipeline_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE pipeline_service_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE query_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE report_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE search_index_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE search_service_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE storage_container_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE storage_service_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE stored_procedure_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE table_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
UPDATE topic_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;
-- Note: user_entity and team_entity already had domains array, so they are not migrated

-- File Entity
CREATE TABLE IF NOT EXISTS file_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.id'))) STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.name'))) VIRTUAL NOT NULL,
    fileType VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.fileType'))) VIRTUAL,
    directoryFqn VARCHAR(768) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.directory.fullyQualifiedName'))) VIRTUAL,
    fqnHash VARCHAR(768) NOT NULL COLLATE ascii_bin,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.updatedAt'))) VIRTUAL NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.updatedBy'))) VIRTUAL NOT NULL,
    deleted TINYINT(1) GENERATED ALWAYS AS (json_extract(json, '$.deleted')) VIRTUAL,
    PRIMARY KEY (id),
    UNIQUE KEY file_entity_fqn_hash (fqnHash),
    KEY idx_file_filetype (fileType),
    KEY idx_file_directory_fqn (directoryFqn)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Spreadsheet Entity
CREATE TABLE IF NOT EXISTS spreadsheet_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.id'))) STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.name'))) VIRTUAL NOT NULL,
    directoryFqn VARCHAR(768) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.directory.fullyQualifiedName'))) VIRTUAL,
    fqnHash VARCHAR(768) NOT NULL COLLATE ascii_bin,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.updatedAt'))) VIRTUAL NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.updatedBy'))) VIRTUAL NOT NULL,
    deleted TINYINT(1) GENERATED ALWAYS AS (json_extract(json, '$.deleted')) VIRTUAL,
    PRIMARY KEY (id),
    UNIQUE KEY spreadsheet_entity_fqn_hash (fqnHash),
    KEY idx_spreadsheet_directory_fqn (directoryFqn)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Worksheet Entity
CREATE TABLE IF NOT EXISTS worksheet_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.id'))) STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.name'))) VIRTUAL NOT NULL,
    spreadsheetFqn VARCHAR(768) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.spreadsheet.fullyQualifiedName'))) VIRTUAL,
    fqnHash VARCHAR(768) NOT NULL COLLATE ascii_bin,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.updatedAt'))) VIRTUAL NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json_unquote(json_extract(json, '$.updatedBy'))) VIRTUAL NOT NULL,
    deleted TINYINT(1) GENERATED ALWAYS AS (json_extract(json, '$.deleted')) VIRTUAL,
    PRIMARY KEY (id),
    UNIQUE KEY worksheet_entity_fqn_hash (fqnHash),
    KEY idx_worksheet_spreadsheet_fqn (spreadsheetFqn)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
-- Clean old test connections
TRUNCATE automations_workflow;

-- Performance optimization indexes for entity_relationship table
-- These indexes improve cascade deletion performance
CREATE INDEX idx_entity_rel_from_delete
ON entity_relationship(fromId, fromEntity, toId, toEntity, relation);

CREATE INDEX idx_entity_rel_to_delete 
ON entity_relationship(toId, toEntity, fromId, fromEntity, relation);

-- Index for cascade queries
CREATE INDEX idx_entity_rel_cascade 
ON entity_relationship(fromId, relation, toEntity, toId);

-- Entity deletion lock table for preventing orphaned entities during cascade deletion
CREATE TABLE IF NOT EXISTS entity_deletion_lock (
    id VARCHAR(36) NOT NULL DEFAULT (UUID()),
    entityId VARCHAR(36) NOT NULL,
    entityType VARCHAR(256) NOT NULL,
    entityFqn VARCHAR(2048) NOT NULL,
    lockType VARCHAR(50) NOT NULL, -- 'DELETE_IN_PROGRESS', 'DELETE_SCHEDULED'
    lockedBy VARCHAR(256) NOT NULL,
    lockedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expectedCompletion TIMESTAMP NULL,
    deletionScope VARCHAR(50), -- 'ENTITY_ONLY', 'CASCADE'
    metadata JSON,
    PRIMARY KEY (id),
    UNIQUE KEY entity_deletion_lock_unique (entityId, entityType),
    INDEX idx_deletion_lock_fqn (entityFqn(255)),
    INDEX idx_deletion_lock_time (lockedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Update columnValuesToBeInSet test definition to include BOOLEAN in supportedDataTypes and update parameterDefinition
UPDATE test_definition
  SET json = JSON_SET(json, '$.supportedDataTypes', JSON_ARRAY('NUMBER', 'INT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'TINYINT', 'SMALLINT', 'BIGINT', 'BYTEINT', 'BYTES', 'STRING', 'MEDIUMTEXT', 'TEXT', 'CHAR', 'VARCHAR', 'BOOLEAN'))
WHERE name in ('columnValuesToBeInSet', 'columnValuesToBeNotInSet');

-- 1. Add generated classificationHash column to support fast lookup and grouping by classification fqnHash
ALTER TABLE tag
  ADD COLUMN classificationHash VARCHAR(255)
  GENERATED ALWAYS AS (SUBSTRING_INDEX(fqnhash, '.', 1)) STORED;

-- 2. Create index on classificationHash + deleted
CREATE INDEX idx_tag_classification_hash_deleted
  ON tag (classificationHash, deleted);

--- 1. Migrate root-level "domain" to "domains"
UPDATE thread_entity SET json = JSON_SET(JSON_REMOVE(json, '$.domain'), '$.domains', JSON_ARRAY(JSON_EXTRACT(json, '$.domain'))) WHERE JSON_EXTRACT(json, '$.domain') IS NOT NULL;

 -- 2. Migrate nested "feedInfo.entitySpecificInfo.entity.domain" to "domains"
 UPDATE thread_entity
 SET json = JSON_SET(
               JSON_REMOVE(json, '$.feedInfo.entitySpecificInfo.entity.domain'),
               '$.feedInfo.entitySpecificInfo.entity.domains',
               JSON_ARRAY(JSON_EXTRACT(json, '$.feedInfo.entitySpecificInfo.entity.domain'))
           )
 WHERE JSON_CONTAINS_PATH(json, 'one', '$.feedInfo.entitySpecificInfo.entity.domain')
   AND JSON_EXTRACT(json, '$.feedInfo.entitySpecificInfo.entity.domain') IS NOT NULL;

 -- 3. Drop old single-domain column
 ALTER TABLE thread_entity
 DROP COLUMN IF EXISTS domain;

 -- 4. Add corrected generated column for multi-domains
 ALTER TABLE thread_entity
 ADD COLUMN domains TEXT
   GENERATED ALWAYS AS (
     CASE
       WHEN JSON_EXTRACT(json, '$.domains') IS NULL
         OR JSON_LENGTH(JSON_EXTRACT(json, '$.domains')) = 0
       THEN NULL
       ELSE JSON_UNQUOTE(JSON_EXTRACT(json, '$.domains'))
     END
   ) STORED;