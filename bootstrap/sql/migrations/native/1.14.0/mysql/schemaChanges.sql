-- Increase test_case name column size to support long dbt-generated test names
-- Fixes: https://github.com/open-metadata/OpenMetadata/issues/25435
ALTER TABLE test_case
  DROP COLUMN `name`,
  ADD COLUMN `name` varchar(2048) GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.name'))) VIRTUAL NOT NULL;
