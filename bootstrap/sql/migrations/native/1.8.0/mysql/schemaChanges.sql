ALTER TABLE background_jobs
ADD COLUMN runAt BIGINT;

CREATE INDEX background_jobs_run_at_index ON background_jobs(runAt);



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

