-- Audit Log Enhancement: Add actor_type, impersonated_by, service_name columns
ALTER TABLE audit_log_event
    ADD COLUMN actor_type VARCHAR(32) DEFAULT 'USER',
    ADD COLUMN impersonated_by VARCHAR(256) DEFAULT NULL,
    ADD COLUMN service_name VARCHAR(256) DEFAULT NULL;

-- Add indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_type_ts ON audit_log_event (actor_type, event_ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_service_name_ts ON audit_log_event (service_name, event_ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log_event (created_at);

-- Update ApplicationBotRole to include Trigger operation
UPDATE policy_entity
SET json = jsonb_set(json::jsonb, '{rules,0,operations}', '["Create", "EditAll", "ViewAll", "Delete", "Trigger"]'::jsonb)
WHERE name = 'ApplicationBotPolicy'
  AND json->'rules'->0->'operations' IS NOT NULL
  AND NOT (json->'rules'->0->'operations' @> '"Trigger"'::jsonb);
