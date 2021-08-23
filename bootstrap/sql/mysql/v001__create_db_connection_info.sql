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
    timestamp BIGINT,
    INDEX edgeIdx (fromId, toId, relation),
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
    timestamp BIGINT,
    INDEX edgeIdx (fromFQN, toFQN, relation),
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
    timestamp BIGINT,
    PRIMARY KEY (id, extension)
);

--
-- Service entities
--
CREATE TABLE IF NOT EXISTS dbservice_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    serviceType VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.serviceType') NOT NULL,
    json JSON NOT NULL,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(name)
);

CREATE TABLE IF NOT EXISTS messaging_service_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    serviceType VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.serviceType') NOT NULL,
    json JSON NOT NULL,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(name)
);

--
-- Data entities
--
CREATE TABLE IF NOT EXISTS database_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.fullyQualifiedName') NOT NULL,
    json JSON NOT NULL,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(fullyQualifiedName)
);

CREATE TABLE IF NOT EXISTS table_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.fullyQualifiedName') NOT NULL,
    json JSON NOT NULL,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(fullyQualifiedName)
);

CREATE TABLE IF NOT EXISTS metric_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.fullyQualifiedName') NOT NULL,
    json JSON NOT NULL,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(fullyQualifiedName)
);

CREATE TABLE IF NOT EXISTS report_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.fullyQualifiedName') NOT NULL,
    json JSON NOT NULL,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(fullyQualifiedName)
);

CREATE TABLE IF NOT EXISTS dashboard_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.fullyQualifiedName') NOT NULL,
    json JSON NOT NULL,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(fullyQualifiedName)
);

CREATE TABLE IF NOT EXISTS pipeline_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.fullyQualifiedName') NOT NULL,
    json JSON NOT NULL,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(fullyQualifiedName)
);

CREATE TABLE IF NOT EXISTS topic_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.fullyQualifiedName') NOT NULL,
    json JSON NOT NULL,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(fullyQualifiedName)
);

--
-- Feed related tables
--
CREATE TABLE IF NOT EXISTS thread_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    json JSON NOT NULL,
    timestamp BIGINT,
    PRIMARY KEY (id)
);

--
-- User, Team, and bots
--
CREATE TABLE IF NOT EXISTS team_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    json JSON NOT NULL,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(name)
);

CREATE TABLE IF NOT EXISTS user_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    email VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.email') NOT NULL,
    deactivated VARCHAR(8) GENERATED ALWAYS AS (json ->> '$.deactivated'),
    json JSON NOT NULL,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(name)
);

CREATE TABLE IF NOT EXISTS bot_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    json JSON NOT NULL,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(name)
);

CREATE TABLE IF NOT EXISTS role_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    json JSON NOT NULL,
    timestamp BIGINT,
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
  UNIQUE KEY unique_name(usageDate, id)
);

--
-- Tag related tables
--
CREATE TABLE IF NOT EXISTS tag_category (
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    json JSON NOT NULL, -- JSON stores category information and does not store children
    timestamp BIGINT,
    UNIQUE KEY unique_name(name) -- Unique tag category name
);

CREATE TABLE IF NOT EXISTS tag (
    fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.fullyQualifiedName') NOT NULL,
    json JSON NOT NULL, -- JSON stores all tag attributes and does not store children
    timestamp BIGINT,
    UNIQUE KEY unique_name(fullyQualifiedName)
);

CREATE TABLE IF NOT EXISTS tag_usage (
    tagFQN VARCHAR(256) NOT NULL,       -- Fully qualified name of the tag
    targetFQN VARCHAR(256) NOT NULL,    -- Fully qualified name of the entity instance or corresponding field
    labelType TINYINT NOT NULL,         -- Type of tagging: manual, automated, propagated, derived
    state TINYINT NOT NULL,             -- State of tagging: suggested or confirmed
    timestamp BIGINT,
    UNIQUE KEY unique_name(tagFQN, targetFQN)
);

CREATE TABLE IF NOT EXISTS audit_log (
    entityId VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.entityId') NOT NULL,
    entityType VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.entityType') NOT NULL,
    username VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.userName') NOT NULL,
    json JSON NOT NULL,
    timestamp BIGINT
);