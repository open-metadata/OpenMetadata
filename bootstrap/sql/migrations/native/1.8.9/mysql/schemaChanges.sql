CREATE TABLE
    IF NOT EXISTS security_service_entity (
        id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
        nameHash VARCHAR(256) NOT NULL COLLATE ascii_bin,
        name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
        serviceType VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.serviceType') NOT NULL,
        json JSON NOT NULL,
        updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
        updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
        deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted'),
        PRIMARY KEY (id),
        UNIQUE (name)
    );
