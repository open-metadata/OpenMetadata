-- Change entity_extension_time_series.timestamp from VIRTUAL to STORED for performance.
-- STORED columns are materialized on disk, making unique constraint checks and range
-- queries on timestamp significantly faster (especially for bulk pipeline status upserts).
-- MySQL does not allow ALTER from VIRTUAL to STORED directly, so we drop and re-add.
-- NOTE: This will lock the table for a full rebuild. On large deployments with millions
-- of rows in entity_extension_time_series, plan for downtime accordingly.
ALTER TABLE entity_extension_time_series
  DROP INDEX entity_extension_time_series_constraint,
  DROP COLUMN `timestamp`,
  ADD COLUMN `timestamp` bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(`json`, _utf8mb4'$.timestamp'))) STORED NOT NULL,
  ADD UNIQUE KEY `entity_extension_time_series_constraint` (`entityFQNHash`, `extension`, `timestamp`);
