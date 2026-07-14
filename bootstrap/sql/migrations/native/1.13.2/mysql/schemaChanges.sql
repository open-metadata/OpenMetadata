-- Data-only migration: retarget the stale owner terms aggregation field
-- (owners.displayName.keyword -> ownerDisplayName) in stored searchSettings.
-- Handled in org.openmetadata.service.migration.mysql.v1132.Migration.

-- Add a supporting index for the compute.percentile query on entity_usage. The 1.13 unique-key
-- reorder to (id, usageDate) sped up usage upserts (which look up by id) but left the percentile
-- UPDATE -- which filters by (usageDate, entityType) with no id -- without a usable index, forcing
-- a full-table scan that grows with history and times out on large catalogs. This supplementary,
-- non-unique index restores the (usageDate, entityType) slice lookup. It deliberately excludes the
-- mutable count columns, so the count-update path optimized by the unique-key reorder is untouched.
-- Guarded so re-running the migration is a no-op.
SET @add_pctl_lookup_idx_sql := (
    SELECT CASE
               WHEN COUNT(*) = 0 THEN 'ALTER TABLE entity_usage ADD INDEX entity_usage_percentile_idx (usageDate, entityType)'
               ELSE 'SELECT 1'
        END
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'entity_usage'
      AND index_name = 'entity_usage_percentile_idx'
);
PREPARE add_pctl_lookup_idx_stmt FROM @add_pctl_lookup_idx_sql;
EXECUTE add_pctl_lookup_idx_stmt;
DEALLOCATE PREPARE add_pctl_lookup_idx_stmt;
