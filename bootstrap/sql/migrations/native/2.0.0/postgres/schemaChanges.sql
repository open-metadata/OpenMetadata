-- Reduce deadlocks/contention for entity_usage upserts by aligning uniqueness with lookup
-- predicate (id, usageDate) instead of the previous (usageDate, id) ordering.
DROP INDEX IF EXISTS entity_usage_id_usage_date_idx;
ALTER TABLE entity_usage DROP CONSTRAINT IF EXISTS entity_usage_usagedate_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS entity_usage_id_usage_date_idx ON entity_usage(id, usageDate);
