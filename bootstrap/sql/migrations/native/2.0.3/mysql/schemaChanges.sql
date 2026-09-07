-- A separate guard fences rebuild writers without holding the live-routing lock.
CREATE TABLE IF NOT EXISTS rdf_rebuild_write_guard (
  id VARCHAR(32) NOT NULL PRIMARY KEY
);
INSERT IGNORE INTO rdf_rebuild_write_guard (id) VALUES ('active');

CREATE TABLE IF NOT EXISTS rdf_rebuild_state (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  rebuildId VARCHAR(36) NOT NULL,
  buildDataset VARCHAR(256) NOT NULL,
  expiresAt BIGINT NOT NULL,
  journalBytes BIGINT NOT NULL DEFAULT 0,
  journalRecords BIGINT NOT NULL DEFAULT 0,
  failure TEXT
);

CREATE TABLE IF NOT EXISTS rdf_rebuild_journal (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rebuildId VARCHAR(36) NOT NULL,
  payload LONGTEXT NOT NULL,
  INDEX idx_rdf_rebuild_journal_run (rebuildId, id)
);
