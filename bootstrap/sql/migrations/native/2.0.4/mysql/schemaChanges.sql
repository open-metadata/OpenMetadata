-- Transient cross-pod WebSocket relay buffer (DB fallback when no Redis). scope+target make one
-- table serve every delivery: USER+userId (sendToOne) and ALL+null (broadcast). Rows expire via expiresAt.
CREATE TABLE IF NOT EXISTS ws_relay_message (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  scope VARCHAR(16) NOT NULL,
  target VARCHAR(256) NULL,
  event VARCHAR(256) NOT NULL,
  payload MEDIUMTEXT NOT NULL,
  senderPod VARCHAR(256) NOT NULL,
  createdAt BIGINT UNSIGNED NOT NULL DEFAULT (UNIX_TIMESTAMP(NOW(3)) * 1000),
  expiresAt BIGINT UNSIGNED NOT NULL
);
CREATE INDEX idx_ws_relay_expiresAt ON ws_relay_message (expiresAt);
