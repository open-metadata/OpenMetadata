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
