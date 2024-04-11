ALTER TABLE test_case ADD COLUMN status VARCHAR(56) GENERATED ALWAYS AS (json -> 'testCaseResult' ->> 'testCaseStatus') STORED NULL;
ALTER TABLE test_case ADD COLUMN entityLink VARCHAR(512) GENERATED ALWAYS AS (json ->> 'entityLink') STORED NOT NULL;

-- change scheduleType to scheduleTimeline
UPDATE installed_apps
SET json = jsonb_set(
        json::jsonb,
        '{appSchedule}',
        jsonb_set(
            json->'appSchedule',
            '{scheduleTimeline}',
            json->'appSchedule'->'scheduleType'
        ) - 'scheduleType',
        true
    )
WHERE json->'appSchedule'->>'scheduleType' IS NOT NULL;

delete from apps_extension_time_series;

-- Change systemApp to system
UPDATE installed_apps
SET json = jsonb_set(
        json::jsonb,
        '{system}',
        json->'systemApp'
    ) - 'systemApp'
WHERE json ? 'systemApp';

UPDATE apps_marketplace
SET json = jsonb_set(
        json::jsonb,
        '{system}',
        json->'systemApp'
    ) - 'systemApp'
WHERE json ? 'systemApp';

