-- column deleted not needed for entities that don't support soft delete
ALTER TABLE query_entity DROP COLUMN deleted;
ALTER TABLE event_subscription_entity DROP COLUMN deleted;

-- create domain entity table
CREATE TABLE IF NOT EXISTS domain_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    fqnHash VARCHAR(256) NOT NULL COLLATE ascii_bin,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
    );

-- create data product entity table
CREATE TABLE IF NOT EXISTS data_product_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    fqnHash VARCHAR(256) NOT NULL COLLATE ascii_bin,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
    );

-- create search service entity
CREATE TABLE IF NOT EXISTS search_service_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    nameHash VARCHAR(256)  NOT NULL COLLATE ascii_bin,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    serviceType VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.serviceType') NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted'),
    PRIMARY KEY (id),
    UNIQUE (nameHash)
    );

-- create search index entity
CREATE TABLE IF NOT EXISTS search_index_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    fqnHash VARCHAR(256) NOT NULL COLLATE ascii_bin,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted'),
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
    );


-- update fqnHash collation to ascii_bin instead of utf8 which will reduce the index sizing and key size.
ALTER TABLE automations_workflow MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin,MODIFY COLUMN workflowType VARCHAR(256) COLLATE ascii_bin, MODIFY COLUMN status VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE entity_extension MODIFY COLUMN extension VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE entity_extension_time_series MODIFY COLUMN entityFQNHash VARCHAR(768) COLLATE ascii_bin, MODIFY COLUMN jsonSchema VARCHAR(50) COLLATE ascii_bin, MODIFY COLUMN extension VARCHAR(100) COLLATE ascii_bin;
ALTER TABLE field_relationship MODIFY COLUMN fromFQNHash VARCHAR(768) COLLATE ascii_bin, MODIFY COLUMN toFQNHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE thread_entity MODIFY COLUMN entityLink VARCHAR(3072), MODIFY COLUMN createdBy VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE event_subscription_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE ingestion_pipeline_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE bot_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE user_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE team_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE role_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE policy_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE classification MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE tag MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE tag_usage MODIFY COLUMN tagFQNHash VARCHAR(768) COLLATE ascii_bin, MODIFY COLUMN targetFQNHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE glossary_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE glossary_term_entity MODIFY fqnHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE type_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE web_analytic_event MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE data_insight_chart MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE kpi_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE test_definition MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE test_connection_definition MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE test_suite MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE test_case MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE db_service_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE messaging_service_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE metadata_service_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE pipeline_service_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE dashboard_service_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE mlmodel_service_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE storage_service_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE database_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE database_schema_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE table_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE dashboard_data_model_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE dashboard_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE chart_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE pipeline_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE ml_model_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE metric_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE query_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE report_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE storage_container_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE topic_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
