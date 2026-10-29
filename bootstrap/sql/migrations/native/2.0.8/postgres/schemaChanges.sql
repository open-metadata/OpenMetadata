-- 2.0.8's Java migration also rewrites stored negated list rules, a data migration,
-- see org.openmetadata.service.migration.utils.v208.MigrationUtil.

-- An FQN hash is one 32-char md5 per level joined by dots, so anything eight or more levels deep
-- (263+ chars) overflowed these varchar(256) columns: tasks on deep entities could not be created,
-- moving a glossary term with tasks to that depth failed, and eighth-level subdomains could not be
-- created. 768 is what the table and container FQN hash columns use.
ALTER TABLE task_entity ALTER COLUMN aboutfqnhash TYPE character varying(768);
ALTER TABLE domain_entity ALTER COLUMN fqnhash TYPE character varying(768);

-- When storage maintenance last compacted the serving dataset, so a compaction that stops
-- happening, for any reason, shows as a degraded projection instead of going unnoticed. 2.1.0 adds
-- the same column for servers that skip this release.
ALTER TABLE rdf_projection_health
  ADD COLUMN IF NOT EXISTS lastCompactedAt BIGINT NOT NULL DEFAULT 0;
