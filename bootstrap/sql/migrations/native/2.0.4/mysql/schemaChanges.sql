-- Cross-pod WebSocket relay (DB fallback when no Redis). A pod that produces a frame whose target
-- socket may live on another pod inserts it here; every pod polls rows newer than its cursor and
-- delivers to its own local sockets. Rows are transient and expire by expiresAt.
-- Generic by design so one table serves every WebSocketManager delivery pattern:
--   scope='USER' + target=<userId>  -> sendToOne (targeted)
--   scope='ALL'  + target=NULL      -> broadCastMessageToAll (every connected user)
-- and leaves room for future scopes (e.g. 'TEAM', 'ROLE') with target = that id, no new migration.
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
