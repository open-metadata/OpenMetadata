CREATE TABLE IF NOT EXISTS role_entity (
   id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
   name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
   json JSON NOT NULL,
   updatedAt TIMESTAMP GENERATED ALWAYS AS (TIMESTAMP(STR_TO_DATE(json ->> '$.updatedAt', '%Y-%m-%dT%T.%fZ'))) NOT NULL,
   updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
   PRIMARY KEY (id),
   UNIQUE KEY unique_name(name),
   INDEX (updatedBy),
   INDEX (updatedAt)
);

ALTER TABLE role_entity
ADD COLUMN deleted BOOLEAN GENERATED ALWAYS AS (JSON_EXTRACT(json, '$.deleted')),
ADD INDEX (deleted);