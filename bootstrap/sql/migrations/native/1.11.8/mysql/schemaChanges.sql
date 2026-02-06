-- Migrate Salesforce connection from sobjectName (string) to sobjectNames (array)
-- Converts sobjectName to sobjectNames array and removes the old field
UPDATE dbservice_entity
SET
    json = JSON_REMOVE (
        JSON_SET (
            json,
            '$.connection.config.sobjectNames',
            JSON_ARRAY (
                JSON_UNQUOTE (
                    JSON_EXTRACT (json, '$.connection.config.sobjectName')
                )
            )
        ),
        '$.connection.config.sobjectName'
    )
WHERE
    serviceType = 'Salesforce'
    AND JSON_TYPE (
        JSON_EXTRACT (json, '$.connection.config.sobjectName')
    ) != 'NULL';

-- Upgrade appliedAt to microsecond precision to match PostgreSQL behavior.
-- Without this, MySQL returns second-precision timestamps which cause spurious
-- diffs in JSON patch operations, leading to deserialization failures.
ALTER TABLE tag_usage MODIFY appliedAt TIMESTAMP(6) NULL DEFAULT CURRENT_TIMESTAMP(6);

-- Change entity_extension_time_series.timestamp from VIRTUAL to STORED for performance.
-- STORED columns are materialized on disk, making unique constraint checks and range
-- queries on timestamp significantly faster (especially for bulk pipeline status upserts).
-- MySQL does not allow ALTER from VIRTUAL to STORED directly, so we drop and re-add.
ALTER TABLE entity_extension_time_series
  DROP INDEX entity_extension_time_series_constraint,
  DROP COLUMN `timestamp`,
  ADD COLUMN `timestamp` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`, _utf8mb4'$.timestamp'))) STORED NOT NULL,
  ADD UNIQUE KEY `entity_extension_time_series_constraint` (`entityFQNHash`, `extension`, `timestamp`);