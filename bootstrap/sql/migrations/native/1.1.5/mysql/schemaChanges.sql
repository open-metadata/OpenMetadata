-- Update table and column profile timestamps to be in milliseconds
UPDATE entity_extension_time_series
    SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.timestamp'),
    '$.timestamp',
    JSON_EXTRACT(json, '$.timestamp') * 1000
    )
WHERE
    extension  in ('table.tableProfile', 'table.columnProfile', 'testCase.testCaseResult');
;

START TRANSACTION;
-- Create report data time series table and move data from entity_extension_time_series
CREATE TABLE IF NOT EXISTS report_data_time_series (
    entityFQNHash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    extension VARCHAR(256) NOT NULL,
    jsonSchema VARCHAR(256) NOT NULL,
    json JSON NOT NULL,
    timestamp BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.timestamp') NOT NULL,
    date DATE GENERATED ALWAYS AS (FROM_UNIXTIME((json ->> '$.timestamp') DIV 1000)) NOT NULL,
    INDEX report_data_time_series_point_ts (timestamp),
    INDEX report_data_time_series_date (date)
);

INSERT INTO report_data_time_series (entityFQNHash,extension,jsonSchema,json)
SELECT entityFQNHash, extension, jsonSchema, json
FROM entity_extension_time_series WHERE extension = 'reportData.reportDataResult';

DELETE FROM entity_extension_time_series
WHERE extension = 'reportData.reportDataResult';
COMMIT;

START TRANSACTION;
-- Create profiler data time series table and move data from entity_extension_time_series
CREATE TABLE IF NOT EXISTS profiler_data_time_series (
    entityFQNHash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    extension VARCHAR(256) NOT NULL,
    jsonSchema VARCHAR(256) NOT NULL,
    json JSON NOT NULL,
    operation VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.operation') NULL,
    timestamp BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.timestamp') NOT NULL,
    UNIQUE profiler_data_time_series_unique_hash_extension_ts (entityFQNHash, extension, operation, timestamp),
    INDEX profiler_data_time_series_combined_id_ts (extension, timestamp)
);

INSERT INTO profiler_data_time_series (entityFQNHash,extension,jsonSchema,json)
SELECT entityFQNHash, extension, jsonSchema, json
FROM entity_extension_time_series
WHERE extension IN ('table.columnProfile', 'table.tableProfile', 'table.systemProfile');

DELETE FROM entity_extension_time_series
WHERE extension IN ('table.columnProfile', 'table.tableProfile', 'table.systemProfile');
COMMIT;

START TRANSACTION;
-- Create data quality data time series table and move data from entity_extension_time_series
CREATE TABLE IF NOT EXISTS data_quality_data_time_series (
    entityFQNHash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    extension VARCHAR(256) NOT NULL,
    jsonSchema VARCHAR(256) NOT NULL,
    json JSON NOT NULL,
    timestamp BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.timestamp') NOT NULL,
    UNIQUE data_quality_data_time_series_unique_hash_extension_ts (entityFQNHash, extension, timestamp),
    INDEX data_quality_data_time_series_combined_id_ts (extension, timestamp)
);

INSERT INTO data_quality_data_time_series (entityFQNHash,extension,jsonSchema,json)
SELECT entityFQNHash, extension, jsonSchema, json
FROM entity_extension_time_series
WHERE extension = 'testCase.testCaseResult';

DELETE FROM entity_extension_time_series
WHERE extension = 'testCase.testCaseResult';
COMMIT;

ALTER TABLE automations_workflow MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin,MODIFY COLUMN workflowType VARCHAR(256) COLLATE ascii_bin, MODIFY COLUMN status VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE entity_extension_time_series MODIFY COLUMN entityFQNHash VARCHAR(768) COLLATE ascii_bin, MODIFY COLUMN jsonSchema VARCHAR(50) COLLATE ascii_bin, MODIFY COLUMN extension VARCHAR(100) COLLATE ascii_bin,
    ADD CONSTRAINT entity_extension_time_series_constraint UNIQUE (entityFQNHash, extension, timestamp);
ALTER TABLE field_relationship MODIFY COLUMN fromFQNHash VARCHAR(768) COLLATE ascii_bin, MODIFY COLUMN toFQNHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE thread_entity MODIFY COLUMN entityLink VARCHAR(3072) GENERATED ALWAYS AS (json ->> '$.about') NOT NULL;
ALTER TABLE event_subscription_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE ingestion_pipeline_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
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
ALTER TABLE dbservice_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
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
ALTER TABLE query_entity MODIFY COLUMN nameHash VARCHAR(256) COLLATE ascii_bin;
ALTER TABLE report_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE storage_container_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
ALTER TABLE topic_entity MODIFY COLUMN fqnHash VARCHAR(768) COLLATE ascii_bin;
