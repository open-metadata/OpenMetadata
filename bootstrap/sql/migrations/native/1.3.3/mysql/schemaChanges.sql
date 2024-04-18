-- Change scheduleType to scheduleTimeline

UPDATE installed_apps
SET json = JSON_INSERT(
        JSON_REMOVE(json, '$.appSchedule.scheduleType'),
        '$.appSchedule.scheduleTimeline',
        JSON_EXTRACT(json, '$.appSchedule.scheduleType')
    );
delete from apps_extension_time_series;


-- Change systemApp to system
UPDATE installed_apps
SET json = JSON_INSERT(
        JSON_REMOVE(json, '$.systemApp'),
        '$.system',
        JSON_EXTRACT(json, '$.systemApp')
    );
UPDATE apps_marketplace
SET json = JSON_INSERT(
        JSON_REMOVE(json, '$.systemApp'),
        '$.system',
        JSON_EXTRACT(json, '$.systemApp')
    );