-- Data-only migration: retarget the stale owner terms aggregation field
-- (owners.displayName.keyword -> ownerDisplayName) in stored searchSettings.
-- Handled in org.openmetadata.service.migration.postgres.v1132.Migration.

-- Add a supporting index for the compute.percentile query on entity_usage. The 1.13 unique-key
-- reorder to (id, usageDate) sped up usage upserts (which look up by id) but left the percentile
-- UPDATE -- which filters by (usageDate, entityType) with no id -- without a usable index, forcing
-- a full-table scan that grows with history and times out on large catalogs. This supplementary
-- index restores the (usageDate, entityType) slice lookup. It deliberately excludes the mutable
-- count columns, so the count-update path optimized by the unique-key reorder is untouched.
--
-- Built CONCURRENTLY so the migration does not take a write lock on entity_usage (a large,
-- actively-written table) for the duration of the build. The DROP ... IF EXISTS first clears any
-- INVALID leftover from a previously interrupted CONCURRENTLY build so this re-runs cleanly.
DROP INDEX CONCURRENTLY IF EXISTS entity_usage_percentile_idx;
CREATE INDEX CONCURRENTLY IF NOT EXISTS entity_usage_percentile_idx ON entity_usage (usageDate, entityType);
