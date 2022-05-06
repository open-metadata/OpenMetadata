--
-- Table that captures all the relationships between entities
--
CREATE TABLE IF NOT EXISTS entity_relationship (
    fromId VARCHAR(36) NOT NULL,                -- ID of the from entity
    toId VARCHAR(36) NOT NULL,                  -- ID of the to entity
    fromEntity VARCHAR(256) NOT NULL,           -- Type name of the from entity
    toEntity VARCHAR(256) NOT NULL,             -- Type name of to entity
    relation TINYINT NOT NULL,
    jsonSchema VARCHAR(256),                    -- Schema used for generating JSON
    json JSON,                                  -- JSON payload with additional information
    deleted BOOLEAN NOT NULL DEFAULT 0,
    -- INDEX edgeIdx (fromId, toId, relation),
    INDEX fromIdx (fromId, relation),
    INDEX toIdx (toId, relation),
    PRIMARY KEY (fromId, toId, relation)
);

--
-- Table that captures all the relationships between field of an entity to a field of another entity
-- Example - table1.column1 (fromFQN of type table.columns.column) is joined with(relation)
-- table2.column8 (toFQN of type table.columns.column)
--
CREATE TABLE IF NOT EXISTS field_relationship (
    fromFQN VARCHAR(256) NOT NULL,              -- Fully qualified name of entity or field
    toFQN VARCHAR(256) NOT NULL,                -- Fully qualified name of entity or field
    fromType VARCHAR(256) NOT NULL,             -- Fully qualified type of entity or field
    toType VARCHAR(256) NOT NULL,               -- Fully qualified type of entity or field
    relation TINYINT NOT NULL,
    jsonSchema VARCHAR(256),                    -- Schema used for generating JSON
    json JSON,                                  -- JSON payload with additional information
    INDEX fromIdx (fromFQN, relation),
    INDEX toIdx (toFQN, relation),
    PRIMARY KEY (fromFQN, toFQN, relation)
);

--
-- Used for storing additional metadata for an entity
--
CREATE TABLE IF NOT EXISTS entity_extension (
    id VARCHAR(36) NOT NULL,                    -- ID of the from entity
    extension VARCHAR(256) NOT NULL,            -- Extension name same as entity.fieldName
    jsonSchema VARCHAR(256) NOT NULL,           -- Schema used for generating JSON
    json JSON NOT NULL,
    PRIMARY KEY (id, extension)
);

--
-- Service entities
--
CREATE REFERENCE TABLE IF NOT EXISTS dbservice_entity (
    id AS (json::$id) PERSISTED VARCHAR(36),
    name AS (json::$name) PERSISTED VARCHAR(256),
    serviceType AS (json::$serviceType) PERSISTED VARCHAR(256),
    json JSON NOT NULL,
    updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
    updatedBy  AS (json::$updatedBy) PERSISTED VARCHAR(256),
    deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(name)
);

CREATE REFERENCE TABLE IF NOT EXISTS messaging_service_entity (
  id AS (json::$id) PERSISTED VARCHAR(36),
  name AS (json::$name) PERSISTED VARCHAR(256),
  serviceType AS (json::$serviceType) PERSISTED VARCHAR(256),
  json JSON NOT NULL,
  updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
  updatedBy  AS (json::$updatedBy) PERSISTED VARCHAR(256),
  deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
  PRIMARY KEY (id),
  UNIQUE KEY unique_name(name)
);

CREATE REFERENCE TABLE IF NOT EXISTS dashboard_service_entity (
  id AS (json::$id) PERSISTED VARCHAR(36),
  name AS (json::$name) PERSISTED VARCHAR(256),
  serviceType AS (json::$serviceType) PERSISTED VARCHAR(256),
  json JSON NOT NULL,
  updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
  updatedBy  AS (json::$updatedBy) PERSISTED VARCHAR(256),
  deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
  PRIMARY KEY (id),
  UNIQUE KEY unique_name(name)
);

CREATE REFERENCE TABLE IF NOT EXISTS pipeline_service_entity (
  id AS (json::$id) PERSISTED VARCHAR(36),
  name AS (json::$name) PERSISTED VARCHAR(256),
  serviceType AS (json::$serviceType) PERSISTED VARCHAR(256),
  json JSON NOT NULL,
  updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
  updatedBy  AS (json::$updatedBy) PERSISTED VARCHAR(256),
  deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
  PRIMARY KEY (id),
  UNIQUE KEY unique_name(name)
);

CREATE REFERENCE TABLE IF NOT EXISTS storage_service_entity (
  id AS (json::$id) PERSISTED VARCHAR(36),
  name AS (json::$name) PERSISTED VARCHAR(256),
  serviceType AS (json::$serviceType) PERSISTED VARCHAR(256),
  json JSON NOT NULL,
  updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
  updatedBy  AS (json::$updatedBy) PERSISTED VARCHAR(256),
  deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
  PRIMARY KEY (id),
  UNIQUE KEY unique_name(name)
);

--
-- Data entities
--
CREATE REFERENCE TABLE IF NOT EXISTS database_entity (
    id AS (json::$id) PERSISTED VARCHAR(36),
    fullyQualifiedName AS (json::$fullyQualifiedName) PERSISTED VARCHAR(256),
    json JSON NOT NULL,
    updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
    updatedBy AS (json::$updatedBy) PERSISTED VARCHAR(256),
    deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(fullyQualifiedName)
);

CREATE REFERENCE TABLE IF NOT EXISTS database_schema_entity (
  id AS (json::$id) PERSISTED VARCHAR(36),
  fullyQualifiedName AS (json::$fullyQualifiedName) PERSISTED VARCHAR(256),
  json JSON NOT NULL,
  updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
  updatedBy AS (json::$updatedBy) PERSISTED VARCHAR(256),
  deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
  PRIMARY KEY (id),
  UNIQUE KEY unique_name(fullyQualifiedName)
);

CREATE REFERENCE TABLE IF NOT EXISTS table_entity (
  id AS (json::$id) PERSISTED VARCHAR(36),
  fullyQualifiedName AS (json::$fullyQualifiedName) PERSISTED VARCHAR(256),
  json JSON NOT NULL,
  updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
  updatedBy AS (json::$updatedBy) PERSISTED VARCHAR(256),
  deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
  PRIMARY KEY (id),
  UNIQUE KEY unique_name(fullyQualifiedName)
);

CREATE REFERENCE TABLE IF NOT EXISTS metric_entity (
  id AS (json::$id) PERSISTED VARCHAR(36),
  fullyQualifiedName AS (json::$fullyQualifiedName) PERSISTED VARCHAR(256),
  json JSON NOT NULL,
  updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
  updatedBy AS (json::$updatedBy) PERSISTED VARCHAR(256),
  deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
  PRIMARY KEY (id),
  UNIQUE KEY unique_name(fullyQualifiedName)
);

CREATE REFERENCE TABLE IF NOT EXISTS report_entity (
  id AS (json::$id) PERSISTED VARCHAR(36),
  fullyQualifiedName AS (json::$fullyQualifiedName) PERSISTED VARCHAR(256),
  json JSON NOT NULL,
  updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
  updatedBy AS (json::$updatedBy) PERSISTED VARCHAR(256),
  deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
  PRIMARY KEY (id),
  UNIQUE KEY unique_name(fullyQualifiedName)
);

CREATE REFERENCE TABLE IF NOT EXISTS dashboard_entity (
  id AS (json::$id) PERSISTED VARCHAR(36),
  fullyQualifiedName AS (json::$fullyQualifiedName) PERSISTED VARCHAR(256),
  json JSON NOT NULL,
  updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
  updatedBy AS (json::$updatedBy) PERSISTED VARCHAR(256),
  deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
  PRIMARY KEY (id),
  UNIQUE KEY unique_name(fullyQualifiedName)
);

CREATE REFERENCE TABLE IF NOT EXISTS ml_model_entity (
  id AS (json::$id) PERSISTED VARCHAR(36),
  fullyQualifiedName AS (json::$fullyQualifiedName) PERSISTED VARCHAR(256),
  json JSON NOT NULL,
  updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
  updatedBy AS (json::$updatedBy) PERSISTED VARCHAR(256),
  deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
  PRIMARY KEY (id),
  UNIQUE KEY unique_name(fullyQualifiedName)
);

CREATE REFERENCE TABLE IF NOT EXISTS pipeline_entity (
  id AS (json::$id) PERSISTED VARCHAR(36),
  fullyQualifiedName AS (json::$fullyQualifiedName) PERSISTED VARCHAR(256),
  json JSON NOT NULL,
  updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
  updatedBy AS (json::$updatedBy) PERSISTED VARCHAR(256),
  deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
  PRIMARY KEY (id),
  UNIQUE KEY unique_name(fullyQualifiedName)
);

CREATE REFERENCE TABLE IF NOT EXISTS topic_entity (
  id AS (json::$id) PERSISTED VARCHAR(36),
  fullyQualifiedName AS (json::$fullyQualifiedName) PERSISTED VARCHAR(256),
  json JSON NOT NULL,
  updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
  updatedBy AS (json::$updatedBy) PERSISTED VARCHAR(256),
  deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
  PRIMARY KEY (id),
  UNIQUE KEY unique_name(fullyQualifiedName)
);

CREATE REFERENCE TABLE IF NOT EXISTS chart_entity (
  id AS (json::$id) PERSISTED VARCHAR(36),
  fullyQualifiedName AS (json::$fullyQualifiedName) PERSISTED VARCHAR(256),
  json JSON NOT NULL,
  updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
  updatedBy AS (json::$updatedBy) PERSISTED VARCHAR(256),
  deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
  PRIMARY KEY (id),
  UNIQUE KEY unique_name(fullyQualifiedName)
);

CREATE REFERENCE TABLE IF NOT EXISTS location_entity (
  id AS (json::$id) PERSISTED VARCHAR(36),
  fullyQualifiedName AS (json::$fullyQualifiedName) PERSISTED VARCHAR(256),
  json JSON NOT NULL,
  updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
  updatedBy AS (json::$updatedBy) PERSISTED VARCHAR(256),
  deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
  PRIMARY KEY (id),
  UNIQUE KEY unique_name(fullyQualifiedName)
);

--
-- Feed related tables
--
CREATE TABLE IF NOT EXISTS thread_entity (
    id AS (json::$id) PERSISTED VARCHAR(36),
    entityId AS (json::$entityId) PERSISTED VARCHAR(36),
    entityLink AS (json::$about) PERSISTED VARCHAR(256),
    assignedTo AS (json::$addressedTo) PERSISTED VARCHAR(256) ,
    json JSON NOT NULL,
    createdAt  AS (json::$threadTs) PERSISTED BIGINT UNSIGNED,
    createdBy  AS (json::$createdBy) PERSISTED VARCHAR(256),
    updatedAt  AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
    updatedBy  AS (json::$updatedBy) PERSISTED VARCHAR(256),
    resolved AS (JSON_EXTRACT_JSON(json, 'resolved')) PERSISTED BOOLEAN,
    PRIMARY KEY (id)
);

--
-- Policies related tables
--
CREATE REFERENCE TABLE IF NOT EXISTS policy_entity (
    id AS (json::$id) PERSISTED VARCHAR(36),
    fullyQualifiedName AS (json::$fullyQualifiedName) PERSISTED VARCHAR(256),
    json JSON NOT NULL,
    updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
    updatedBy AS (json::$updatedBy) PERSISTED VARCHAR(256),
    deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(fullyQualifiedName)
);

--
-- Ingestion related tables
--
CREATE REFERENCE TABLE IF NOT EXISTS ingestion_pipeline_entity (
    id AS (json::$id) PERSISTED VARCHAR(36),
    fullyQualifiedName AS (json::$fullyQualifiedName) PERSISTED VARCHAR(256),
    json JSON NOT NULL,
    updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
    updatedBy AS (json::$updatedBy) PERSISTED VARCHAR(256),
    deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(fullyQualifiedName)
);

--
-- User, Team, and bots
--
CREATE REFERENCE TABLE IF NOT EXISTS team_entity (
    id AS (json::$id) PERSISTED VARCHAR(36),
    name AS (json::$name) PERSISTED VARCHAR(256),
    json JSON NOT NULL,
    updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
    updatedBy AS (json::$updatedBy) PERSISTED VARCHAR(256),
    deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(name)
);

CREATE REFERENCE TABLE IF NOT EXISTS user_entity (
    id AS (json::$id) PERSISTED VARCHAR(36),
    name AS (json::$name) PERSISTED VARCHAR(256),
    email AS (json::$email) PERSISTED VARCHAR(256),
    deactivated AS (json::$deactivated) PERSISTED VARCHAR(8),
    json JSON NOT NULL,
    updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
    updatedBy AS (json::$updatedBy) PERSISTED VARCHAR(256),
    deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(name)
);

CREATE REFERENCE TABLE IF NOT EXISTS bot_entity (
    id AS (json::$id) PERSISTED VARCHAR(36),
    name AS (json::$name) PERSISTED VARCHAR(256),
    json JSON NOT NULL,
    updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
    updatedBy AS (json::$updatedBy) PERSISTED VARCHAR(256),
    deleted  AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(name)
);

CREATE REFERENCE TABLE IF NOT EXISTS role_entity (
    id AS (json::$id) PERSISTED VARCHAR(36),
    name AS (json::$name) PERSISTED VARCHAR(256),
    json JSON NOT NULL,
    updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
    updatedBy AS (json::$updatedBy) PERSISTED VARCHAR(256),
    deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
    defaultRole AS (JSON_EXTRACT_JSON(json, 'defaultRole')) PERSISTED BOOLEAN,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(name)
);

--
-- Usage table where usage for all the entities is captured
--
CREATE TABLE IF NOT EXISTS entity_usage (
  id VARCHAR(36) NOT NULL,     -- Unique id of the entity
  entityType VARCHAR(20) NOT NULL, -- name of the entity for which this usage is published
  usageDate DATE,           -- date corresponding to the usage
  count1 INT,               -- total daily count of use on usageDate
  count7 INT,               -- rolling count of last 7 days going back from usageDate
  count30 INT,              -- rolling count of last 30 days going back from usageDate
  percentile1 INT,  -- percentile rank with in same entity for given usage date
  percentile7 INT,  -- percentile rank with in same entity for last 7 days of usage
  percentile30 INT, -- percentile rank with in same entity for last 30 days of usage
  SHARD KEY(usageDate, id),
  UNIQUE KEY unique_name(usageDate, id)
);

--
-- Tag related tables
--
CREATE REFERENCE TABLE IF NOT EXISTS tag_category (
    id AS (json::$id) PERSISTED VARCHAR(36),
    name AS (json::$name) PERSISTED VARCHAR(256),
    json JSON NOT NULL, -- JSON stores category information and does not store children
    updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
    updatedBy AS (json::$updatedBy) PERSISTED VARCHAR(256),
    deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
    UNIQUE KEY unique_name(name) -- Unique tag category name
);

CREATE TABLE IF NOT EXISTS tag (
    id AS (json::$id) PERSISTED VARCHAR(36),
    fullyQualifiedName AS (json::$fullyQualifiedName) PERSISTED VARCHAR(256),
    json JSON NOT NULL, -- JSON stores all tag attributes and does not store children
    updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
    updatedBy AS (json::$updatedBy) PERSISTED VARCHAR(256),
    deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
    SHARD KEY (fullyQualifiedName),
    UNIQUE KEY unique_name(fullyQualifiedName)
);

CREATE TABLE IF NOT EXISTS tag_usage (
    source TINYINT NOT NULL,            -- Source of the tag label
    tagFQN VARCHAR(256) NOT NULL,       -- Fully qualified name of the tag
    targetFQN VARCHAR(256) NOT NULL,    -- Fully qualified name of the entity instance or corresponding field
    labelType TINYINT NOT NULL,         -- Type of tagging: manual, automated, propagated, derived
    state TINYINT NOT NULL,             -- State of tagging: suggested or confirmed
    SHARD KEY (source, tagFQN, targetFQN),
    UNIQUE KEY unique_name(source, tagFQN, targetFQN)
);

CREATE TABLE IF NOT EXISTS change_event (
    eventType AS (json::$eventType) PERSISTED VARCHAR(36),
    entityType AS (json::$entityType) PERSISTED VARCHAR(36),
    userName AS (json::$userName) PERSISTED VARCHAR(256),
    eventTime AS (json::$timestamp) PERSISTED BIGINT UNSIGNED,
    json JSON NOT NULL,
    INDEX (eventType),
    INDEX (entityType),
    INDEX (eventTime)
);

CREATE REFERENCE TABLE IF NOT EXISTS webhook_entity (
    id AS (json::$id) PERSISTED VARCHAR(36),
    name AS (json::$name) PERSISTED VARCHAR(256),
    deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
    json JSON NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(name)
    -- No versioning, updatedAt, updatedBy, or changeDescription fields for webhook
);

CREATE REFERENCE TABLE IF NOT EXISTS glossary_entity (
    id AS (json::$id) PERSISTED VARCHAR(36),
    name AS (json::$name) PERSISTED VARCHAR(256),
    json JSON NOT NULL,
    updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
    updatedBy AS (json::$updatedBy) PERSISTED VARCHAR(256),
    deleted AS (JSON_EXTRACT(json, 'deleted')) PERSISTED BOOLEAN,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(name)
);

CREATE REFERENCE TABLE IF NOT EXISTS glossary_term_entity (
    id AS (json::$id) PERSISTED VARCHAR(36),
    fullyQualifiedName AS (json::$fullyQualifiedName) PERSISTED VARCHAR(256),
    json JSON NOT NULL,
    updatedAt AS (json::$updatedAt) PERSISTED BIGINT UNSIGNED,
    updatedBy AS (json::$updatedBy) PERSISTED VARCHAR(256),
    deleted AS (JSON_EXTRACT_JSON(json, 'deleted')) PERSISTED BOOLEAN,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(fullyQualifiedName)
);
