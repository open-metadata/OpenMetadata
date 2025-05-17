-- Add runtime: enabled for AutoPilot
UPDATE apps_marketplace
SET json = JSON_SET(
    json,
    '$.runtime.enabled',
    true
)
WHERE name = 'AutoPilotApplication';

CREATE TABLE IF NOT EXISTS data_contract_entity (
  id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
  name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
  fqnHash VARCHAR(768) NOT NULL,
  json JSON NOT NULL,
  updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
  updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
  deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted') NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (fqnHash),
  INDEX (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Add index for deleted flag
ALTER TABLE data_contract_entity ADD INDEX index_data_contract_entity_deleted(deleted);
