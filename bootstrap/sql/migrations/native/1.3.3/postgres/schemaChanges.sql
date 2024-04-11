-- change scheduleType to scheduleTimeline, this was failing earlier in 1.3.2 so updating it here
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

-- Change systemApp to system, this was failing earlier in 1.3.2 so updating it here
UPDATE installed_apps
SET json = jsonb_set(
        json::jsonb,
        '{system}',
        json->'systemApp'
    ) - 'systemApp'
WHERE jsonb_exists(json::jsonb, 'systemApp') = true;

UPDATE apps_marketplace
SET json = jsonb_set(
        json::jsonb,
        '{system}',
        json->'systemApp'
    ) - 'systemApp'
WHERE jsonb_exists(json::jsonb, 'systemApp') = true;
