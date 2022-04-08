DROP TABLE IF EXISTS thread_entity;

CREATE TABLE IF NOT EXISTS thread_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    entityId VARCHAR(36) GENERATED ALWAYS AS (json ->> 'entityId') STORED NOT NULL,
    entityLink VARCHAR(256) GENERATED ALWAYS AS (json ->> 'about') STORED NOT NULL,
    assignedTo VARCHAR(256) GENERATED ALWAYS AS (json ->> 'addressedTo') STORED,
    json JSONB NOT NULL,
    createdAt BIGINT GENERATED ALWAYS AS ((json ->> 'threadTs')::bigint) STORED NOT NULL,
    createdBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'createdBy') STORED NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    resolved BOOLEAN GENERATED ALWAYS AS ((json ->> 'resolved')::boolean) STORED,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS glossary_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE(name)
);

CREATE TABLE IF NOT EXISTS glossary_term_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE(fullyQualifiedName)
);


-- Set default as false for all existing roles except DataConsumer, to avoid unintended manipulation of roles during migration.
ALTER TABLE role_entity
    ADD COLUMN defaultRole BOOLEAN GENERATED ALWAYS AS ((json ->> 'defaultRole')::boolean) STORED;

UPDATE role_entity
SET json =  json || jsonb '{"defaultRole": false}';

UPDATE role_entity
SET json =  json || jsonb '{"defaultRole": true}'
WHERE name = 'DataConsumer';



-- Add tag label source
ALTER TABLE tag_usage
ADD COLUMN source SMALLINT NOT NULL DEFAULT 0, -- Source of tag (either from TagCategory or Glossary)
DROP CONSTRAINT "tag_usage_tagfqn_targetfqn_key",
ADD UNIQUE(source, tagFQN, targetFQN);
