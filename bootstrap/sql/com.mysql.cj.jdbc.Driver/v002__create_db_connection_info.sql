CREATE TABLE IF NOT EXISTS type_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    category VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.category') NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (name)
);

ALTER TABLE webhook_entity
ADD status VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.status') NOT NULL,
DROP COLUMN deleted;

ALTER TABLE entity_relationship
DROP INDEX edge_index;

ALTER TABLE thread_entity
ADD taskId INT UNSIGNED GENERATED ALWAYS AS (json ->> '$.task.id'),
ADD taskStatus VARCHAR(64) GENERATED ALWAYS AS (json ->> '$.task.status'),
ADD CONSTRAINT task_id_constraint UNIQUE(taskId),
ADD INDEX task_status_index (taskStatus),
ADD INDEX created_by_index (createdBy),
ADD INDEX updated_at_index (updatedAt);

CREATE TABLE task_sequence (id INT NOT NULL AUTO_INCREMENT, PRIMARY KEY (id));
INSERT INTO task_sequence VALUES (0);
