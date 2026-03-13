-- Rename 'preview' to 'enabled' in apps, inverting the boolean value
-- preview=false (can be used) becomes enabled=true, preview=true becomes enabled=false
UPDATE apps_marketplace
SET json = (json - 'preview') || jsonb_build_object(
    'enabled',
    CASE
        WHEN json -> 'preview' = 'null'::jsonb THEN true
        WHEN (json -> 'preview')::boolean = true THEN false
        ELSE true
    END
)
WHERE jsonb_exists(json, 'preview');

UPDATE installed_apps
SET json = (json - 'preview') || jsonb_build_object(
    'enabled',
    CASE
        WHEN json -> 'preview' = 'null'::jsonb THEN true
        WHEN (json -> 'preview')::boolean = true THEN false
        ELSE true
    END
)
WHERE jsonb_exists(json, 'preview');

-- Rename 'preview' to 'enabled' in event_subscription_entity config.app
-- The App JSON is stored as an escaped JSON string inside config.app, so we need string replacement
UPDATE event_subscription_entity
SET json = jsonb_set(
    json,
    '{config,app}',
    to_jsonb(
        replace(
            replace(
                json->'config'->>'app',
                '"preview":false',
                '"enabled":true'
            ),
            '"preview":true',
            '"enabled":false'
        )
    )
)
WHERE json->'config'->>'app' LIKE '%"preview"%';

-- Clean up QRTZ tables to remove stale persisted job data that may contain old App JSON with 'preview'
TRUNCATE TABLE QRTZ_SIMPLE_TRIGGERS;
TRUNCATE TABLE QRTZ_CRON_TRIGGERS;
TRUNCATE TABLE QRTZ_TRIGGERS;
TRUNCATE TABLE QRTZ_LOCKS;
TRUNCATE TABLE QRTZ_SCHEDULER_STATE;
TRUNCATE TABLE QRTZ_JOB_DETAILS;
TRUNCATE TABLE QRTZ_FIRED_TRIGGERS;
