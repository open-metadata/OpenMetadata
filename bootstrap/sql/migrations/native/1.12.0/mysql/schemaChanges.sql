-- Audit Log Enhancement: Add actor_type, impersonated_by, service_name columns
ALTER TABLE audit_log_event
    ADD COLUMN actor_type VARCHAR(32) DEFAULT 'USER' AFTER user_name,
    ADD COLUMN impersonated_by VARCHAR(256) DEFAULT NULL AFTER actor_type,
    ADD COLUMN service_name VARCHAR(256) DEFAULT NULL AFTER impersonated_by;

-- Add indexes for efficient filtering
CREATE INDEX idx_audit_log_actor_type_ts ON audit_log_event (actor_type, event_ts DESC);
CREATE INDEX idx_audit_log_service_name_ts ON audit_log_event (service_name, event_ts DESC);
CREATE INDEX idx_audit_log_created_at ON audit_log_event (created_at);


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