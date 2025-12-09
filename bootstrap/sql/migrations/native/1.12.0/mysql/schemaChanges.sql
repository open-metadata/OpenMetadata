-- Add enabled field to test_definition table for Rules Library feature
-- This allows administrators to enable/disable test definitions in the rules library

-- Add virtual column for enabled field
-- CAST is needed to convert JSON boolean (true/false) to TINYINT (1/0)
ALTER TABLE test_definition
  ADD COLUMN enabled TINYINT(1)
  GENERATED ALWAYS AS (COALESCE(CAST(json_extract(json, '$.enabled') AS UNSIGNED), 1))
  VIRTUAL;

-- Add index for filtering enabled/disabled test definitions
CREATE INDEX idx_test_definition_enabled ON test_definition(enabled);

-- Set all existing test definitions to enabled by default
UPDATE test_definition
  SET json = JSON_SET(json, '$.enabled', true)
  WHERE json_extract(json, '$.enabled') IS NULL;
