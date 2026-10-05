-- Transient cross-pod WebSocket relay buffer (DB fallback when no Redis). scope+target make one
-- table serve every delivery: USER+userId (sendToOne) and ALL+null (broadcast). Rows expire via expiresAt.
CREATE TABLE IF NOT EXISTS ws_relay_message (
  id BIGSERIAL PRIMARY KEY,
  scope VARCHAR(16) NOT NULL,
  target VARCHAR(256) NULL,
  event VARCHAR(256) NOT NULL,
  payload TEXT NOT NULL,
  senderPod VARCHAR(256) NOT NULL,
  createdAt BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  expiresAt BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ws_relay_expiresAt ON ws_relay_message (expiresAt);
