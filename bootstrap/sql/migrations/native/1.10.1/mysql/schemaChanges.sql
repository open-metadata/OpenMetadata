-- Create table for persisted audit log events
CREATE TABLE IF NOT EXISTS audit_log_event (
  id BIGINT NOT NULL AUTO_INCREMENT,
  change_event_id CHAR(36) NOT NULL,
  event_ts BIGINT NOT NULL,
  event_type VARCHAR(32) NOT NULL,
  user_name VARCHAR(256) DEFAULT NULL,
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
  KEY idx_audit_log_event_entity_hash_ts (entity_fqn_hash, event_ts DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
