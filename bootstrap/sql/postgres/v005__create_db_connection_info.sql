CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS database_schema_entity (
    id VARCHAR(36) NOT NULL GENERATED ALWAYS AS (json ->> 'id') STORED,
    fullyQualifiedName VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED,
    json JSONB NOT NULL,
    updatedAt BIGINT NOT NULL GENERATED ALWAYS AS (json ->> 'updatedAt') STORED,
    updatedBy VARCHAR(256) NOT NULL GENERATED ALWAYS AS (json ->> 'updatedBy') STORED,
    deleted BOOLEAN NOT NULL GENERATED ALWAYS AS (json ->> 'deleted' :: boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE(fullyQualifiedName)
);

--
-- Drop indexes for deleted boolean column
-- Drop unused indexes for updatedAt and updatedBy
--
ALTER TABLE airflow_pipeline_entity RENAME TO ingestion_pipeline_entity;

ALTER TABLE tag_category
ADD COLUMN id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL DEFAULT (uuid_generate_v4() :: VARCHAR(36));

UPDATE tag_category
SET json = json || jsonb_build_object("id", id);

ALTER TABLE tag
ADD COLUMN id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL DEFAULT (uuid_generate_v4() :: VARCHAR(36));

UPDATE tag
SET json = json || jsonb_build_object("id", id);
