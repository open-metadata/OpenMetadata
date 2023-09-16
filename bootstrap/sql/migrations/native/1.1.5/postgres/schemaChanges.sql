-- Update table and column profile timestamps to be in milliseconds
UPDATE entity_extension_time_series
SET json = jsonb_set(
	json,
	'{timestamp}',
	to_jsonb(cast(json#>'{timestamp}' as int8) *1000)
)
WHERE
	extension  in ('table.tableProfile', 'table.columnProfile', 'testCase.testCaseResult');
;

BEGIN;
-- Run the following SQL to update the schema in a transaction
-- Create report data time series table and move data from entity_extension_time_series
CREATE TABLE IF NOT EXISTS report_data_time_series (
    entityFQNHash VARCHAR(768),
    extension VARCHAR(256) NOT NULL,
    jsonSchema VARCHAR(256) NOT NULL,
    json JSONB NOT NULL,
    timestamp BIGINT CHECK (timestamp > 0) GENERATED ALWAYS AS ((json ->> 'timestamp')::bigint) STORED NOT NULL
);
CREATE INDEX IF NOT EXISTS report_data_time_series_point_ts ON report_data_time_series (timestamp);

INSERT INTO report_data_time_series (entityFQNHash,extension,jsonSchema,json)

SELECT entityFQNHash, extension, jsonSchema, json
FROM entity_extension_time_series WHERE extension = 'reportData.reportDataResult';

DELETE FROM entity_extension_time_series
WHERE extension = 'reportData.reportDataResult';
COMMIT;

BEGIN;
-- Create profiler data time series table and move data from entity_extension_time_series
CREATE TABLE IF NOT EXISTS profiler_data_time_series (
    entityFQNHash VARCHAR(768),
    extension VARCHAR(256) NOT NULL,
    jsonSchema VARCHAR(256) NOT NULL,
    json JSON NOT NULL,
    operation VARCHAR(256) GENERATED ALWAYS AS ((json ->> 'operation')::text) STORED NULL,
    timestamp BIGINT CHECK (timestamp > 0) GENERATED ALWAYS AS ((json ->> 'timestamp')::bigint) STORED NOT NULL,
    CONSTRAINT profiler_data_time_series_unique_hash_extension_ts UNIQUE(entityFQNHash, extension, operation, timestamp)
);

CREATE INDEX IF NOT EXISTS profiler_data_time_series_combined_id_ts ON profiler_data_time_series (extension, timestamp);

INSERT INTO profiler_data_time_series (entityFQNHash,extension,jsonSchema,json)
SELECT entityFQNHash, extension, jsonSchema, json
FROM entity_extension_time_series
WHERE extension IN ('table.columnProfile', 'table.tableProfile', 'table.systemProfile');

DELETE FROM entity_extension_time_series
WHERE extension IN ('table.columnProfile', 'table.tableProfile', 'table.systemProfile');
COMMIT;

BEGIN;
-- Create profiler data time series table and move data from entity_extension_time_series
CREATE TABLE IF NOT EXISTS data_quality_data_time_series (
    entityFQNHash VARCHAR(768),
    extension VARCHAR(256) NOT NULL,
    jsonSchema VARCHAR(256) NOT NULL,
    json JSON NOT NULL,
    timestamp BIGINT CHECK (timestamp > 0) GENERATED ALWAYS AS ((json ->> 'timestamp')::bigint) STORED NOT NULL,
    CONSTRAINT data_quality_data_time_series_unique_hash_extension_ts UNIQUE(entityFQNHash, extension, timestamp)
);

CREATE INDEX IF NOT EXISTS data_quality_data_time_series_combined_id_ts ON data_quality_data_time_series (extension, timestamp);

INSERT INTO data_quality_data_time_series (entityFQNHash,extension,jsonSchema,json)
SELECT entityFQNHash, extension, jsonSchema, json
FROM entity_extension_time_series
WHERE extension = 'testCase.testCaseResult';

DELETE FROM entity_extension_time_series
WHERE extension = 'testCase.testCaseResult';
COMMIT;

ALTER TABLE entity_extension_time_series ALTER COLUMN entityFQNHash TYPE VARCHAR(768), ALTER COLUMN jsonSchema TYPE VARCHAR(50) , ALTER COLUMN extension TYPE VARCHAR(100) ,
    ADD CONSTRAINT entity_extension_time_series_constraint UNIQUE (entityFQNHash, extension, timestamp);
ALTER TABLE field_relationship ALTER COLUMN fromFQNHash TYPE VARCHAR(768), ALTER COLUMN toFQNHash TYPE VARCHAR(768);
ALTER TABLE thread_entity ALTER COLUMN entityLink TYPE VARCHAR(3072);
ALTER TABLE tag_usage ALTER COLUMN tagFQNHash TYPE VARCHAR(768), ALTER COLUMN targetFQNHash TYPE VARCHAR(768);
ALTER TABLE test_suite ALTER COLUMN fqnHash TYPE VARCHAR(768);
