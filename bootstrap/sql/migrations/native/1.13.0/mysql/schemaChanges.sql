-- Rename 'preview' to 'enabled' in apps, inverting the boolean value
-- preview=false (can be used) becomes enabled=true, preview=true becomes enabled=false
UPDATE apps_marketplace
SET json = JSON_SET(
    JSON_REMOVE(json, '$.preview'),
    '$.enabled',
    CASE
        WHEN JSON_EXTRACT(json, '$.preview') = true THEN CAST('false' AS JSON)
        ELSE CAST('true' AS JSON)
    END
)
WHERE JSON_CONTAINS_PATH(json, 'one', '$.preview');

UPDATE installed_apps
SET json = JSON_SET(
    JSON_REMOVE(json, '$.preview'),
    '$.enabled',
    CASE
        WHEN JSON_EXTRACT(json, '$.preview') = true THEN CAST('false' AS JSON)
        ELSE CAST('true' AS JSON)
    END
)
WHERE JSON_CONTAINS_PATH(json, 'one', '$.preview');

-- Reduce deadlocks for entity_usage upserts by making the unique key follow the lookup predicate
-- (id, usageDate) instead of (usageDate, id).
SET @migrate_usage_date_idx_sql := (
    SELECT CASE
               WHEN COUNT(*) = 0 THEN 'ALTER TABLE entity_usage ADD UNIQUE INDEX usageDate (id, usageDate)'
               WHEN SUM(seq_in_index = 1 AND column_name = 'id' AND non_unique = 0) > 0 THEN 'SELECT 1'
               ELSE 'ALTER TABLE entity_usage DROP INDEX usageDate, ADD UNIQUE INDEX usageDate (id, usageDate)'
        END
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'entity_usage'
      AND index_name = 'usageDate'
);
PREPARE migrate_usage_date_idx_stmt FROM @migrate_usage_date_idx_sql;
EXECUTE migrate_usage_date_idx_stmt;
DEALLOCATE PREPARE migrate_usage_date_idx_stmt;

-- Rename 'preview' to 'enabled' in event_subscription_entity config.app
-- The App JSON is stored as an escaped JSON string inside config.app, so we need string replacement
UPDATE event_subscription_entity
SET json = JSON_SET(
    json,
    '$.config.app',
    REPLACE(
        REPLACE(
            JSON_UNQUOTE(JSON_EXTRACT(json, '$.config.app')),
            '"preview":false',
            '"enabled":true'
        ),
        '"preview":true',
        '"enabled":false'
    )
)
WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.config.app')) LIKE '%"preview"%';

-- Clean up QRTZ tables to remove stale persisted job data that may contain old App JSON with 'preview'
-- Delete FK children first, then parents. Using DELETE (not TRUNCATE) to respect FK constraints.
DELETE FROM QRTZ_SIMPLE_TRIGGERS;
DELETE FROM QRTZ_CRON_TRIGGERS;
DELETE FROM QRTZ_SIMPROP_TRIGGERS;
DELETE FROM QRTZ_BLOB_TRIGGERS;
DELETE FROM QRTZ_TRIGGERS;
DELETE FROM QRTZ_JOB_DETAILS;
DELETE FROM QRTZ_FIRED_TRIGGERS;
DELETE FROM QRTZ_LOCKS;
DELETE FROM QRTZ_SCHEDULER_STATE;
