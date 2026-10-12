-- Add a supporting index for the compute.percentile query on entity_usage. The 1.13 unique-key
-- reorder to (id, usageDate) sped up usage upserts (which look up by id) but left the percentile
-- UPDATE -- which filters by (usageDate, entityType) with no id -- without a usable index, forcing
-- a full-table scan that grows with history and times out on large catalogs. This supplementary,
-- non-unique index restores the (usageDate, entityType) slice lookup. It deliberately excludes the
-- mutable count columns, so the count-update path optimized by the unique-key reorder is untouched.
-- Plain ALTER: InnoDB ADD INDEX is online + atomic, and the migration runner skips already-applied
-- statements by hash, so re-runs are a no-op without an information_schema pre-check.
ALTER TABLE entity_usage ADD INDEX entity_usage_percentile_idx (usageDate, entityType);
