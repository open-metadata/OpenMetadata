-- Reduce deadlocks/contention for entity_usage upserts by aligning index with lookup predicate (id, usageDate)
CREATE INDEX IF NOT EXISTS entity_usage_id_usage_date_idx ON entity_usage(id, usageDate);
