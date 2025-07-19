-- Create table for tracking index mapping versions
CREATE TABLE IF NOT EXISTS index_mapping_versions (
    entityType VARCHAR(256) NOT NULL,
    mappingHash VARCHAR(32) COLLATE ascii_bin NOT NULL,
    mappingJson JSON NOT NULL,
    version VARCHAR(36) NOT NULL,
    updatedAt BIGINT UNSIGNED NOT NULL,
    updatedBy VARCHAR(256) NOT NULL,
    PRIMARY KEY (entityType),
    INDEX idx_version (version),
    INDEX idx_updatedAt (updatedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;