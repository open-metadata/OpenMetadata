--
-- Drop indexes for deleted boolean column
-- Drop unused indexes for updatedAt and updatedBy
--
ALTER TABLE field_relationship
DROP INDEX edgeIdx;

ALTER TABLE dbservice_entity
DROP INDEX deleted,
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE messaging_service_entity
DROP INDEX deleted,
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE dashboard_service_entity
DROP INDEX deleted,
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE pipeline_service_entity
DROP INDEX deleted,
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE storage_service_entity
DROP INDEX deleted,
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE database_entity
DROP INDEX deleted,
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE table_entity
DROP INDEX deleted,
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE metric_entity
DROP INDEX deleted,
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE report_entity
DROP INDEX deleted,
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE dashboard_entity
DROP INDEX deleted,
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE ml_model_entity
DROP INDEX deleted,
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE pipeline_entity
DROP INDEX deleted,
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE topic_entity
DROP INDEX deleted,
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE chart_entity
DROP INDEX deleted,
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE location_entity
DROP INDEX deleted,
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE thread_entity
DROP INDEX updatedBy;

ALTER TABLE policy_entity
DROP INDEX deleted,
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE team_entity
DROP INDEX deleted,
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE user_entity
DROP INDEX deleted,
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE bot_entity
DROP INDEX deleted,
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE role_entity
DROP INDEX deleted,
DROP INDEX defaultRole,
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE tag_category
DROP INDEX deleted,
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE tag
DROP INDEX deleted,
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE airflow_pipeline_entity
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE glossary_entity
DROP INDEX updatedAt,
DROP INDEX updatedBy;

ALTER TABLE glossary_term_entity
DROP INDEX updatedAt,
DROP INDEX updatedBy;


CREATE TABLE IF NOT EXISTS database_schema_entity (
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

--
-- Drop indexes for deleted boolean column
-- Drop unused indexes for updatedAt and updatedBy
--
RENAME TABLE airflow_pipeline_entity to ingestion_pipeline_entity;

ALTER TABLE tag_category
ADD COLUMN id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL FIRST;

UPDATE tag_category
SET json = JSON_SET(json, '$.id', UUID());

ALTER TABLE tag
ADD COLUMN id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL FIRST;

UPDATE tag
SET json = JSON_SET(json, '$.id', UUID());

