-- Create table for persisted audit log events
CREATE TABLE IF NOT EXISTS audit_log_event (
    id BIGSERIAL PRIMARY KEY,
    change_event_id UUID NOT NULL,
    event_ts BIGINT NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    user_name VARCHAR(256),
    actor_type VARCHAR(32) DEFAULT 'USER',
    impersonated_by VARCHAR(256) DEFAULT NULL,
    service_name VARCHAR(256) DEFAULT NULL,
    entity_type VARCHAR(128),
    entity_id UUID,
    entity_fqn VARCHAR(768),
    entity_fqn_hash VARCHAR(768),
    event_json TEXT NOT NULL,
    created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- Add indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_type_ts ON audit_log_event (actor_type, event_ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_service_name_ts ON audit_log_event (service_name, event_ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log_event (created_at);


-- Add enabled field to test_definition table for Rules Library feature
-- This allows administrators to enable/disable test definitions in the rules library

-- Add generated column for enabled field with default true for existing rows
ALTER TABLE test_definition
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN GENERATED ALWAYS AS (
    COALESCE((json ->> 'enabled')::boolean, true)
  ) STORED;

-- Add index for filtering enabled/disabled test definitions
CREATE INDEX IF NOT EXISTS idx_test_definition_enabled ON test_definition(enabled);

-- Set all existing test definitions to enabled by default
UPDATE test_definition
  SET json = jsonb_set(json::jsonb, '{enabled}', 'true'::jsonb, true)::json
  WHERE json ->> 'enabled' IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_log_event_change_event_id
ON audit_log_event (change_event_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_ts
ON audit_log_event (event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_user_ts
ON audit_log_event (user_name, event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_entity_hash_ts
ON audit_log_event (entity_fqn_hash, event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_type_ts
ON audit_log_event (actor_type, event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_service_name_ts
ON audit_log_event (service_name, event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
ON audit_log_event (created_at);
