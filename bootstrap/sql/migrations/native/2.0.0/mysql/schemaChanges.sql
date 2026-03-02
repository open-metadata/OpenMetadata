-- Reduce deadlocks for entity_usage upserts by making the unique key follow the lookup predicate
-- (id, usageDate) instead of (usageDate, id).
SET @has_usage_date_idx := (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'entity_usage'
      AND index_name = 'usageDate'
);
SET @has_desired_usage_date_idx := (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'entity_usage'
      AND index_name = 'usageDate'
      AND seq_in_index = 1
      AND column_name = 'id'
      AND non_unique = 0
);
SET @migrate_usage_date_idx_sql := IF(
    @has_desired_usage_date_idx > 0,
    'SELECT 1',
    IF(
        @has_usage_date_idx > 0,
        'ALTER TABLE entity_usage DROP INDEX usageDate, ADD UNIQUE INDEX usageDate (id, usageDate)',
        'ALTER TABLE entity_usage ADD UNIQUE INDEX usageDate (id, usageDate)'
    )
);
PREPARE migrate_usage_date_idx_stmt FROM @migrate_usage_date_idx_sql;
EXECUTE migrate_usage_date_idx_stmt;
DEALLOCATE PREPARE migrate_usage_date_idx_stmt;
