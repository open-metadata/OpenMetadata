-- Perf: entity_usage is upserted on every usage event and read back by id alone
-- (insertOrReplaceCount/insertOrUpdateCount recomputing count7/count30, getUsageById,
-- getLatestUsage, getLatestUsageBatch, delete-by-id). Those reads filter on `id`; this index
-- gives them a dedicated id-first access path independent of the upsert unique key, whose shape
-- has changed across releases ((usageDate, id) before 1.13.0, (id, usageDate) since) and which
-- the DBA may drop/rebuild during the upsert-deadlock tuning.
-- Re-check information_schema because an interrupted run can commit the index creation
-- before the migration runner records its statement hash.
SET @entity_usage_id_index_ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'entity_usage'
        AND index_name = 'idx_entity_usage_id'
    ),
    'SELECT 1',
    'ALTER TABLE entity_usage ADD INDEX idx_entity_usage_id (id)'
  )
);
PREPARE entity_usage_id_index_stmt FROM @entity_usage_id_index_ddl;
EXECUTE entity_usage_id_index_stmt;
DEALLOCATE PREPARE entity_usage_id_index_stmt;
