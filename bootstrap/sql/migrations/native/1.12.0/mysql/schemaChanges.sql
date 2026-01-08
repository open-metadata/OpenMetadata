-- Audit Log Enhancement: Add actor_type, impersonated_by, service_name columns
ALTER TABLE audit_log_event
    ADD COLUMN actor_type VARCHAR(32) DEFAULT 'USER' AFTER user_name,
    ADD COLUMN impersonated_by VARCHAR(256) DEFAULT NULL AFTER actor_type,
    ADD COLUMN service_name VARCHAR(256) DEFAULT NULL AFTER impersonated_by;

-- Add indexes for efficient filtering
CREATE INDEX idx_audit_log_actor_type_ts ON audit_log_event (actor_type, event_ts DESC);
CREATE INDEX idx_audit_log_service_name_ts ON audit_log_event (service_name, event_ts DESC);
CREATE INDEX idx_audit_log_created_at ON audit_log_event (created_at);
