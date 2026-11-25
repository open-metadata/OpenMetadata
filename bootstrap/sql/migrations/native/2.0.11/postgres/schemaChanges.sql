-- Perf: entity_usage is upserted on every usage event and read back by id alone
-- (insertOrReplaceCount/insertOrUpdateCount recomputing count7/count30, getUsageById,
-- getLatestUsage, getLatestUsageBatch, delete-by-id). Those reads filter on `id`; this index
-- gives them a dedicated id-first access path independent of the upsert unique key, whose shape
-- has changed across releases ((usageDate, id) before 1.13.0, (id, usageDate) since) and which
-- the DBA may drop/rebuild during the upsert-deadlock tuning.
CREATE INDEX IF NOT EXISTS idx_entity_usage_id ON entity_usage (id);
