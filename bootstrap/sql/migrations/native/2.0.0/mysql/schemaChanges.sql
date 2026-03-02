-- Reduce deadlocks for entity_usage upserts by making the unique key follow the lookup predicate
-- (id, usageDate) instead of (usageDate, id).
ALTER TABLE entity_usage
DROP INDEX usageDate,
ADD UNIQUE INDEX usageDate (id, usageDate);
