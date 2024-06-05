-- Add a new table di_chart_entity
CREATE TABLE IF NOT EXISTS di_chart_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.fullyQualifiedName') NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    fqnHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted'),
    UNIQUE(name),
    INDEX name_index (name)
);

CREATE INDEX IF NOT EXISTS name_index ON di_chart_entity(name);