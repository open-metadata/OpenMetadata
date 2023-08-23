-- Create report data time series table and move data from entity_extension_time_series
CREATE TABLE IF NOT EXISTS report_data_time_series (
    entityFQNHash VARCHAR(768) CHARACTER SET ascii STORED NOT NULL,
    extension VARCHAR(256) STORED NOT NULL,
    jsonSchema VARCHAR(256) STORED NOT NULL,
    json JSONB STORED NOT NULL,
    timestamp BIGINT CHECK (timestamp > 0) GENERATED ALWAYS AS ((json ->> 'timestamp')::bigint) STORED NOT NULL,
    INDEX combined_id_ts (timestamp)
);

INSERT INTO report_data_time_series (entityFQNHash,extension,jsonSchema,json)
SELECT entityFQNHash, extension, jsonSchema, json
FROM entity_extension_time_series WHERE extension = 'reportData.reportDataResult';

DELETE FROM entity_extension_time_series
WHERE extension = 'reportData.reportDataResult';

-- Create profiler data time series table and move data from entity_extension_time_series
CREATE TABLE IF NOT EXISTS profiler_data_time_series (
    entityFQNHash VARCHAR(768) CHARACTER SET ascii STORED NOT NULL,
    extension VARCHAR(256) STORED NOT NULL,
    jsonSchema VARCHAR(256) STORED NOT NULL,
    json JSON STORED NOT NULL,
    timestamp BIGINT CHECK (timestamp > 0) GENERATED ALWAYS AS ((json ->> 'timestamp')::bigint) STORED NOT NULL,
    UNIQUE unique_hash_extension_ts (entityFQNHash, extension, timestamp),
    INDEX combined_id_ts (extension, timestamp)
);

INSERT INTO profiler_data_time_series (entityFQNHash,extension,jsonSchema,json)
SELECT entityFQNHash, extension, jsonSchema, json
FROM entity_extension_time_series
WHERE extension IN ('table.columnProfile', 'table.tableProfile', 'table.systemProfile');

DELETE FROM entity_extension_time_series
WHERE extension IN ('table.columnProfile', 'table.tableProfile', 'table.systemProfile');

-- Create profiler data time series table and move data from entity_extension_time_series
CREATE TABLE IF NOT EXISTS data_quality_data_time_series (
    entityFQNHash VARCHAR(768) CHARACTER SET ascii STORED NOT NULL,
    extension VARCHAR(256) STORED NOT NULL,
    jsonSchema VARCHAR(256) STORED NOT NULL,
    json JSON STORED NOT NULL,
    timestamp BIGINT CHECK (timestamp > 0) GENERATED ALWAYS AS ((json ->> 'timestamp')::bigint) STORED NOT NULL,
    UNIQUE unique_hash_extension_ts (entityFQNHash, extension, timestamp),
    INDEX combined_id_ts (extension, timestamp)
);

INSERT INTO data_quality_data_time_series (entityFQNHash,extension,jsonSchema,json)
SELECT entityFQNHash, extension, jsonSchema, json
FROM entity_extension_time_series
WHERE extension = 'testCase.testCaseResult';

DELETE FROM entity_extension_time_series
WHERE extension = 'testCase.testCaseResult';

ALTER TABLE entity_extension_time_series ALTER COLUMN entityFQNHash TYPE VARCHAR(768), ALTER COLUMN jsonSchema TYPE VARCHAR(50) , ALTER COLUMN extension TYPE VARCHAR(100) ,
    ADD CONSTRAINT entity_extension_time_series_constraint UNIQUE (entityFQNHash, extension, timestamp);
ALTER TABLE field_relationship ALTER COLUMN fromFQNHash TYPE VARCHAR(768), ALTER COLUMN toFQNHash TYPE VARCHAR(768);
ALTER TABLE thread_entity ALTER COLUMN entityLink TYPE VARCHAR(3072);
ALTER TABLE tag_usage ALTER COLUMN tagFQNHash TYPE VARCHAR(768), ALTER COLUMN targetFQNHash TYPE VARCHAR(768);
ALTER TABLE test_suite ALTER COLUMN fqnHash TYPE VARCHAR(768);
