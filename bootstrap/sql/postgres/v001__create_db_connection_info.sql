CREATE FUNCTION to_tz_timestamp(text) RETURNS TIMESTAMP WITH TIME ZONE AS
$$
    select to_timestamp($1, '%Y-%m-%dT%T.%fZ')::timestamptz;
$$
LANGUAGE sql immutable;

--
-- Table that captures all the relationships between entities
--
CREATE TABLE IF NOT EXISTS entity_relationship (
    fromId VARCHAR(36) NOT NULL,                -- ID of the from entity
    toId VARCHAR(36) NOT NULL,                  -- ID of the to entity
    fromEntity VARCHAR(256) NOT NULL,           -- Type name of the from entity
    toEntity VARCHAR(256) NOT NULL,             -- Type name of to entity
    relation SMALLINT NOT NULL,
    jsonSchema VARCHAR(256),                    -- Schema used for generating JSON
    json JSONB,                                  -- JSON payload with additional information
    timestamp BIGINT,
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
    relation SMALLINT NOT NULL,
    jsonSchema VARCHAR(256),                    -- Schema used for generating JSON
    json JSONB,                                  -- JSON payload with additional information
    timestamp BIGINT,
    PRIMARY KEY (fromFQN, toFQN, relation)
);

--
-- Used for storing additional metadata for an entity
--
CREATE TABLE IF NOT EXISTS entity_extension (
    id VARCHAR(36) NOT NULL,                    -- ID of the from entity
    extension VARCHAR(256) NOT NULL,            -- Extension name same as entity.fieldName
    jsonSchema VARCHAR(256) NOT NULL,           -- Schema used for generating JSON
    json JSONB NOT NULL,
    timestamp BIGINT,
    PRIMARY KEY (id, extension)
);

--
-- Service entities
--
CREATE TABLE IF NOT EXISTS dbservice_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    name VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'name') STORED,
    serviceType VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'serviceType') STORED,
    json JSONB NOT NULL,
    updatedAt TIMESTAMP WITH TIME ZONE NOT NULL GENERATED ALWAYS AS (to_tz_timestamp(json ->> 'updatedAt')) STORED,
    updatedBy VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'updatedBy') STORED,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS messaging_service_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    name VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'name') STORED,
    serviceType VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'serviceType') STORED,
    json JSONB NOT NULL,
    updatedAt TIMESTAMP WITH TIME ZONE NOT NULL GENERATED ALWAYS AS (to_tz_timestamp(json ->> 'updatedAt')) STORED,
    updatedBy VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'updatedBy') STORED,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS dashboard_service_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    name VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'name') STORED,
    serviceType VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'serviceType') STORED,
    json JSONB NOT NULL,
    updatedAt TIMESTAMP WITH TIME ZONE NOT NULL GENERATED ALWAYS AS (to_tz_timestamp(json ->> 'updatedAt')) STORED,
    updatedBy VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'updatedBy') STORED,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS pipeline_service_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    name VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'name') STORED,
    serviceType VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'serviceType') STORED,
    json JSONB NOT NULL,
    updatedAt TIMESTAMP WITH TIME ZONE NOT NULL GENERATED ALWAYS AS (to_tz_timestamp(json ->> 'updatedAt')) STORED,
    updatedBy VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'updatedBy') STORED,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS storage_service_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    name VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'name') STORED,
    serviceType VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'serviceType') STORED,
    json JSONB NOT NULL,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE(name)
);

--
-- Data entities
--
CREATE TABLE IF NOT EXISTS database_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    fullyQualifiedName VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED,
    json JSONB NOT NULL,
    updatedAt TIMESTAMP WITH TIME ZONE NOT NULL GENERATED ALWAYS AS (to_tz_timestamp(json ->> 'updatedAt')) STORED,
    updatedBy VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'updatedBy') STORED,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE(fullyQualifiedName)
);

CREATE TABLE IF NOT EXISTS table_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    fullyQualifiedName VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED,
    json JSONB NOT NULL,
    updatedAt TIMESTAMP WITH TIME ZONE NOT NULL GENERATED ALWAYS AS (to_tz_timestamp(json ->> 'updatedAt')) STORED,
    updatedBy VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'updatedBy') STORED,
    PRIMARY KEY (id),
    UNIQUE(fullyQualifiedName)
);

CREATE TABLE IF NOT EXISTS dbt_model_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    fullyQualifiedName VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED,
    json JSONB NOT NULL,
    updatedAt TIMESTAMP WITH TIME ZONE NOT NULL GENERATED ALWAYS AS (to_tz_timestamp(json ->> 'updatedAt')) STORED,
    updatedBy VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'updatedBy') STORED,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE(fullyQualifiedName)
);

CREATE TABLE IF NOT EXISTS metric_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    fullyQualifiedName VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED,
    json JSONB NOT NULL,
    updatedAt TIMESTAMP WITH TIME ZONE NOT NULL GENERATED ALWAYS AS (to_tz_timestamp(json ->> 'updatedAt')) STORED,
    updatedBy VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'updatedBy') STORED,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE(fullyQualifiedName)
);

CREATE TABLE IF NOT EXISTS report_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    fullyQualifiedName VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED,
    json JSONB NOT NULL,
    updatedAt TIMESTAMP WITH TIME ZONE NOT NULL GENERATED ALWAYS AS (to_tz_timestamp(json ->> 'updatedAt')) STORED,
    updatedBy VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'updatedBy') STORED,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE(fullyQualifiedName)
);

CREATE TABLE IF NOT EXISTS dashboard_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    fullyQualifiedName VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED,
    json JSONB NOT NULL,
    updatedAt TIMESTAMP WITH TIME ZONE NOT NULL GENERATED ALWAYS AS (to_tz_timestamp(json ->> 'updatedAt')) STORED,
    updatedBy VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'updatedBy') STORED,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE(fullyQualifiedName)
);

CREATE TABLE IF NOT EXISTS ml_model_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    fullyQualifiedName VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED,
    json JSONB NOT NULL,
    updatedAt TIMESTAMP WITH TIME ZONE NOT NULL GENERATED ALWAYS AS (to_tz_timestamp(json ->> 'updatedAt')) STORED,
    updatedBy VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'updatedBy') STORED,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE(fullyQualifiedName)
);

CREATE TABLE IF NOT EXISTS pipeline_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    fullyQualifiedName VARCHAR(512) NOT NULL GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED,
    json JSONB NOT NULL,
    updatedAt TIMESTAMP WITH TIME ZONE NOT NULL GENERATED ALWAYS AS (to_tz_timestamp(json ->> 'updatedAt')) STORED,
    updatedBy VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'updatedBy') STORED,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE(fullyQualifiedName)
);

CREATE TABLE IF NOT EXISTS topic_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    fullyQualifiedName VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED,
    json JSONB NOT NULL,
    updatedAt TIMESTAMP WITH TIME ZONE NOT NULL GENERATED ALWAYS AS (to_tz_timestamp(json ->> 'updatedAt')) STORED,
    updatedBy VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'updatedBy') STORED,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE(fullyQualifiedName)
);

CREATE TABLE IF NOT EXISTS chart_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    fullyQualifiedName VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED,
    json JSONB NOT NULL,
    updatedAt TIMESTAMP WITH TIME ZONE NOT NULL GENERATED ALWAYS AS (to_tz_timestamp(json ->> 'updatedAt')) STORED,
    updatedBy VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'updatedBy') STORED,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE(fullyQualifiedName)
);

CREATE TABLE IF NOT EXISTS location_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    fullyQualifiedName VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED,
    json JSONB NOT NULL,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE(fullyQualifiedName)
);

--
-- Feed related tables
--
CREATE TABLE IF NOT EXISTS thread_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    json JSONB NOT NULL,
    timestamp BIGINT,
    PRIMARY KEY (id)
);

--
-- Policies related tables
--
CREATE TABLE IF NOT EXISTS policy_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    fullyQualifiedName VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED,
    json JSONB NOT NULL,
    updatedAt TIMESTAMP WITH TIME ZONE NOT NULL GENERATED ALWAYS AS (to_tz_timestamp(json ->> 'updatedAt')) STORED,
    updatedBy VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'updatedBy') STORED,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE(fullyQualifiedName)
);

--
-- Ingestion related tables
--
CREATE TABLE IF NOT EXISTS ingestion_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    fullyQualifiedName VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED,
    json JSONB NOT NULL,
    updatedAt TIMESTAMP WITH TIME ZONE NOT NULL GENERATED ALWAYS AS (to_tz_timestamp(json ->> 'updatedAt')) STORED,
    updatedBy VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'updatedBy') STORED,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE(fullyQualifiedName)
);

--
-- User, Team, and bots
--
CREATE TABLE IF NOT EXISTS team_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    name VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'name') STORED,
    json JSONB NOT NULL,
    updatedAt TIMESTAMP WITH TIME ZONE NOT NULL GENERATED ALWAYS AS (to_tz_timestamp(json ->> 'updatedAt')) STORED,
    updatedBy VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'updatedBy') STORED,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS user_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    name VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'name') STORED,
    email VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'email') STORED,
    deactivated VARCHAR(8) GENERATED ALWAYS AS (json ->> 'deactivated') STORED,
    json JSONB NOT NULL,
    updatedAt TIMESTAMP WITH TIME ZONE NOT NULL GENERATED ALWAYS AS (to_tz_timestamp(json ->> 'updatedAt')) STORED,
    updatedBy VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'updatedBy') STORED,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS bot_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    name VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'name') STORED,
    json JSONB NOT NULL,
    updatedAt TIMESTAMP WITH TIME ZONE NOT NULL GENERATED ALWAYS AS (to_tz_timestamp(json ->> 'updatedAt')) STORED,
    updatedBy VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'updatedBy') STORED,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS role_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    name VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'name') STORED,
    json JSONB NOT NULL,
    timestamp BIGINT,
    PRIMARY KEY (id),
    UNIQUE(name)
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
  UNIQUE(usageDate, id)
);

--
-- Tag related tables
--
CREATE TABLE IF NOT EXISTS tag_category (
    name VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'name') STORED,
    json JSONB NOT NULL, -- JSON stores category information and does not store children
    updatedAt TIMESTAMP WITH TIME ZONE NOT NULL GENERATED ALWAYS AS (to_tz_timestamp(json ->> 'updatedAt')) STORED,
    updatedBy VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'updatedBy') STORED,
    timestamp BIGINT,
    UNIQUE(name) -- Unique tag category name
);

CREATE TABLE IF NOT EXISTS tag (
    fullyQualifiedName VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED,
    json JSONB NOT NULL, -- JSON stores all tag attributes and does not store children
    updatedAt TIMESTAMP WITH TIME ZONE NOT NULL GENERATED ALWAYS AS (to_tz_timestamp(json ->> 'updatedAt')) STORED,
    updatedBy VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'updatedBy') STORED,
    timestamp BIGINT,
    UNIQUE(fullyQualifiedName)
);

CREATE TABLE IF NOT EXISTS tag_usage (
    tagFQN VARCHAR(256) NOT NULL,       -- Fully qualified name of the tag
    targetFQN VARCHAR(256) NOT NULL,    -- Fully qualified name of the entity instance or corresponding field
    labelType SMALLINT NOT NULL,         -- Type of tagging: manual, automated, propagated, derived
    state SMALLINT NOT NULL,             -- State of tagging: suggested or confirmed
    timestamp BIGINT,
    UNIQUE(tagFQN, targetFQN)
);

CREATE TABLE IF NOT EXISTS change_event (
    eventType VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'eventType') STORED,
    entityType VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'entityType') STORED,
    userName VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'userName') STORED,
    dateTime TIMESTAMP WITH TIME ZONE NOT NULL GENERATED ALWAYS AS (to_tz_timestamp(json ->> 'dateTime')) STORED,
    json JSONB NOT NULL
);