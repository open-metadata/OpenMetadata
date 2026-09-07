-- A separate guard fences rebuild writers without holding the live-routing lock.
CREATE TABLE IF NOT EXISTS rdf_rebuild_write_guard (
  id VARCHAR(32) NOT NULL PRIMARY KEY
);
INSERT INTO rdf_rebuild_write_guard (id) VALUES ('active') ON CONFLICT (id) DO NOTHING;

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
  id BIGSERIAL PRIMARY KEY,
  rebuildId VARCHAR(36) NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rdf_rebuild_journal_run ON rdf_rebuild_journal (rebuildId, id);
