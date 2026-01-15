-- Update ApplicationBotRole to include Trigger operation
UPDATE policy_entity
SET json = JSON_ARRAY_APPEND(json, '$.rules[0].operations', 'Trigger')
WHERE name = 'ApplicationBotPolicy'
  AND JSON_EXTRACT(json, '$.rules[0].operations') IS NOT NULL
  AND NOT JSON_CONTAINS(JSON_EXTRACT(json, '$.rules[0].operations'), '"Trigger"');

-- Create table for persisted audit log events
CREATE TABLE IF NOT EXISTS audit_log_event (
  id BIGINT NOT NULL AUTO_INCREMENT,
  change_event_id CHAR(36) NOT NULL,
  event_ts BIGINT NOT NULL,
  event_type VARCHAR(32) NOT NULL,
  user_name VARCHAR(256) DEFAULT NULL,
  actor_type VARCHAR(32) DEFAULT 'USER',
  impersonated_by VARCHAR(256) DEFAULT NULL,
  service_name VARCHAR(256) DEFAULT NULL,
  entity_type VARCHAR(128) DEFAULT NULL,
  entity_id CHAR(36) DEFAULT NULL,
  entity_fqn VARCHAR(768) DEFAULT NULL,
  entity_fqn_hash VARCHAR(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  event_json LONGTEXT NOT NULL,
  created_at BIGINT DEFAULT (UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000),
  PRIMARY KEY (id),
  UNIQUE KEY idx_audit_log_event_change_event_id (change_event_id),
  KEY idx_audit_log_event_ts (event_ts DESC),
  KEY idx_audit_log_event_user_ts (user_name, event_ts DESC),
  KEY idx_audit_log_event_entity_hash_ts (entity_fqn_hash, event_ts DESC),
  KEY idx_audit_log_actor_type_ts (actor_type, event_ts DESC),
  KEY idx_audit_log_service_name_ts (service_name, event_ts DESC),
  KEY idx_audit_log_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



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
