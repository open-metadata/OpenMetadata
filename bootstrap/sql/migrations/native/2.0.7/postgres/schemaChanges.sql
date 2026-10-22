-- Two governance workflow reads look runs up by the entity they ran for: the run list on an
-- entity's page (entityLink filter) and Data Retention's "is there a newer run of this workflow for
-- this entity" probe. Nothing indexed entityLink, so both scanned workflow_instance_time_series.
-- entityLink is unbounded TEXT, too long for a btree key, so the index keys its md5; runs with no
-- entity share md5(''). Queries must use this exact expression for the planner to pick the index.
--
-- Built CONCURRENTLY so the index build takes no write lock on this actively-written table; each
-- statement runs outside an implicit transaction, which the native migration runner supports.
--
-- OPERATOR NOTE: an interrupted CONCURRENTLY build leaves an INVALID index behind, and the
-- runner keys statements by SQL-text hash so it will not self-heal on retry. Detection and
-- recovery are the same as the runbook in 1.13.0/postgres/schemaChanges.sql: DROP INDEX the
-- invalid entry, then re-run the migration.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wf_instance_entity_link
  ON workflow_instance_time_series (md5(COALESCE(entityLink, '')), workflowDefinitionId, timestamp);
