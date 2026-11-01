-- 2.0.8's Java migration also rewrites stored negated list rules, a data migration,
-- see org.openmetadata.service.migration.utils.v208.MigrationUtil.

-- An FQN hash is one 32-char md5 per level joined by dots, so anything eight or more levels deep
-- (263+ chars) overflowed these varchar(256) columns: tasks on deep entities could not be created,
-- moving a glossary term with tasks to that depth failed, and eighth-level subdomains could not be
-- created. 768 is what the table and container FQN hash columns use. aboutFqnHash moves to ascii
-- like the other hash columns: at utf8mb4, 768 chars no longer fit idx_status_about in InnoDB's
-- 3072-byte key.
ALTER TABLE task_entity MODIFY COLUMN aboutFqnHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (json_unquote(json_extract(`json`,_utf8mb4'$.aboutFqnHash'))) STORED;
ALTER TABLE domain_entity MODIFY COLUMN fqnHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;

-- When storage maintenance last compacted the serving dataset, so a compaction that stops
-- happening, for any reason, shows as a degraded projection instead of going unnoticed. Guarded,
-- because 2.1.0 adds the same column for servers that skip this release.
SET @rdf_projection_health_compaction_ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'rdf_projection_health'
        AND column_name = 'lastCompactedAt'
    ),
    'SELECT 1',
    'ALTER TABLE rdf_projection_health ADD COLUMN lastCompactedAt bigint NOT NULL DEFAULT 0'
  )
);
PREPARE rdf_projection_health_compaction_stmt FROM @rdf_projection_health_compaction_ddl;
EXECUTE rdf_projection_health_compaction_stmt;
DEALLOCATE PREPARE rdf_projection_health_compaction_stmt;

-- Transfer RDF delivery to pause-aware consumers before producing pipelineExecution payloads.
-- Deleting first waits for an old in-flight delivery; old producers still use the enqueue guard.
DELETE FROM rdf_live_write_guard WHERE id = 'drain';
INSERT IGNORE INTO rdf_live_write_guard (id) VALUES ('drain-v2');
