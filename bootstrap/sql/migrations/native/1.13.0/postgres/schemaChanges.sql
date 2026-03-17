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

-- Reduce deadlocks for entity_usage upserts by reordering the unique constraint columns
-- to (id, usageDate) so that row-level locks follow the lookup predicate order.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_attribute a1 ON a1.attrelid = c.conrelid AND a1.attnum = c.conkey[1]
        JOIN pg_attribute a2 ON a2.attrelid = c.conrelid AND a2.attnum = c.conkey[2]
        WHERE c.conrelid = 'entity_usage'::regclass
          AND c.contype = 'u'
          AND a1.attname = 'id'
          AND a2.attname = 'usageDate'
    ) THEN
        -- Drop the old constraint (usageDate, id) if it exists
        IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'entity_usage'::regclass AND contype = 'u'
        ) THEN
            EXECUTE format('ALTER TABLE entity_usage DROP CONSTRAINT %I',
                (SELECT conname FROM pg_constraint WHERE conrelid = 'entity_usage'::regclass AND contype = 'u' LIMIT 1));
        END IF;
        ALTER TABLE entity_usage ADD CONSTRAINT entity_usage_id_usagedate_key UNIQUE (id, usageDate);
    END IF;
END $$;

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
