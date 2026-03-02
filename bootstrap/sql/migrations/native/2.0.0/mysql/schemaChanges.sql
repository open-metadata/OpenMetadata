-- Reduce deadlocks for entity_usage upserts by making the unique key follow the lookup predicate
-- (id, usageDate) instead of (usageDate, id).
SET @has_usage_date_idx := (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'entity_usage'
      AND index_name = 'usageDate'
);
SET @drop_usage_date_idx_sql := IF(
    @has_usage_date_idx > 0,
    'ALTER TABLE entity_usage DROP INDEX usageDate',
    'SELECT 1'
);
PREPARE drop_usage_date_idx_stmt FROM @drop_usage_date_idx_sql;
EXECUTE drop_usage_date_idx_stmt;
DEALLOCATE PREPARE drop_usage_date_idx_stmt;

SET @has_new_usage_date_idx := (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'entity_usage'
      AND index_name = 'usageDate'
      AND seq_in_index = 1
      AND column_name = 'id'
);
SET @add_usage_date_idx_sql := IF(
    @has_new_usage_date_idx = 0,
    'ALTER TABLE entity_usage ADD UNIQUE INDEX usageDate (id, usageDate)',
    'SELECT 1'
);
PREPARE add_usage_date_idx_stmt FROM @add_usage_date_idx_sql;
EXECUTE add_usage_date_idx_stmt;
DEALLOCATE PREPARE add_usage_date_idx_stmt;
