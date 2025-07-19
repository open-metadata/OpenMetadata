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