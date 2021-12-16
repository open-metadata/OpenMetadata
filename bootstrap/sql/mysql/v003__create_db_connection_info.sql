CREATE TABLE IF NOT EXISTS webhook_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    json JSON NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY unique_name(name)
    -- No versioning, updatedAt, updatedBy, or changeDescription fields for webhook
);