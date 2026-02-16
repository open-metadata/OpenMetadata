-- Task System Redesign - OpenMetadata 2.0.0
-- This migration creates the new Task entity tables and related infrastructure

CREATE TABLE IF NOT EXISTS task_entity (
    id varchar(36) NOT NULL,
    json json NOT NULL,
    fqnHash varchar(768) NOT NULL,
    taskId varchar(20) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.taskId'))) STORED NOT NULL,
    name varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) STORED NOT NULL,
    category varchar(32) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.category'))) STORED NOT NULL,
    type varchar(64) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.type'))) STORED NOT NULL,
    status varchar(32) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.status'))) STORED NOT NULL,
    priority varchar(16) GENERATED ALWAYS AS (COALESCE(json_unquote(json_extract(`json`,_utf8mb4'$.priority')), 'Medium')) STORED,
    createdAt bigint GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.createdAt'))) STORED NOT NULL,
    updatedAt bigint GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.updatedAt'))) STORED NOT NULL,
    deleted tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.deleted')) STORED,
    aboutFqnHash varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.aboutFqnHash'))) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uk_fqn_hash (fqnHash),
    KEY idx_task_id (taskId),
    KEY idx_status (status),
    KEY idx_category (category),
    KEY idx_type (type),
    KEY idx_priority (priority),
    KEY idx_created_at (createdAt),
    KEY idx_updated_at (updatedAt),
    KEY idx_deleted (deleted),
    KEY idx_status_category (status, category),
    KEY idx_about_fqn_hash (aboutFqnHash),
    KEY idx_status_about (status, aboutFqnHash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS new_task_sequence (
    id bigint NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO new_task_sequence (id) SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM new_task_sequence);

-- =====================================================
-- ACTIVITY STREAM TABLE (Partitioned by time)
-- Lightweight, ephemeral activity notifications
-- NOT for audit/compliance - use entity version history
-- Partitions are managed dynamically by ActivityStreamPartitionManager
-- =====================================================
CREATE TABLE IF NOT EXISTS activity_stream (
    id varchar(36) NOT NULL,
    eventType varchar(64) NOT NULL,
    entityType varchar(64) NOT NULL,
    entityId varchar(36) NOT NULL,
    entityFqnHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin,
    about varchar(2048),
    aboutFqnHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin,
    actorId varchar(36) NOT NULL,
    actorName varchar(256),
    timestamp bigint NOT NULL,
    summary varchar(500),
    fieldName varchar(256),
    oldValue text,
    newValue text,
    domains json,
    json json NOT NULL,
    PRIMARY KEY (id, timestamp),
    KEY idx_activity_timestamp (timestamp),
    KEY idx_activity_entity (entityType, entityId, timestamp),
    KEY idx_activity_actor (actorId, timestamp),
    KEY idx_activity_event_type (eventType, timestamp),
    KEY idx_activity_entity_fqn (entityFqnHash, timestamp),
    KEY idx_activity_about (aboutFqnHash, timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
PARTITION BY RANGE (timestamp) (
    -- Catch-all partition - ActivityStreamPartitionManager will reorganize this
    -- by splitting it into monthly partitions as needed
    PARTITION p_max VALUES LESS THAN MAXVALUE
);

-- Activity stream configuration per domain
CREATE TABLE IF NOT EXISTS activity_stream_config (
    id varchar(36) NOT NULL,
    json json NOT NULL,
    scope varchar(32) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.scope'))) STORED NOT NULL,
    domainId varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.scopeReference.id'))) STORED,
    enabled tinyint(1) GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.enabled')) STORED,
    retentionDays int GENERATED ALWAYS AS (json_extract(`json`,_utf8mb4'$.retentionDays')) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uk_domain_config (domainId),
    KEY idx_scope (scope),
    KEY idx_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
