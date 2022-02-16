DROP TABLE IF EXISTS thread_entity;

CREATE TABLE IF NOT EXISTS thread_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    entityLink VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.about') NOT NULL,
    assignedTo VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.addressedTo'),
    json JSON NOT NULL,
    createdAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.threadTs') STORED NOT NULL,
    createdBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.createdBy') STORED NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    resolved BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.resolved')),
    PRIMARY KEY (id),
    INDEX (updatedBy),
    INDEX (updatedAt)
);

CREATE TABLE IF NOT EXISTS glossary_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(name),
    INDEX (updatedBy),
    INDEX (updatedAt)
);
CREATE TABLE IF NOT EXISTS glossary_term_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.fullyQualifiedName') NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(fullyQualifiedName),
    INDEX (updatedBy),
    INDEX (updatedAt)
);
