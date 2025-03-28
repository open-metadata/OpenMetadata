-- Add runtime: enabled for AutoPilot
UPDATE apps_marketplace
SET json = JSON_SET(
    json,
    '$.runtime.enabled',
    true
)
WHERE name = 'AutoPilotApplication';

-- update to multiple appSchedules
UPDATE installed_apps
SET `json` = JSON_SET(
    `json`,
    '$.appSchedule.id',
    UUID()
)
WHERE JSON_EXTRACT(`json`, '$.appSchedule') IS NOT NULL;

UPDATE installed_apps
SET `json` = JSON_SET(
    `json`,
    '$.appSchedules',
    JSON_ARRAY(JSON_EXTRACT(`json`, '$.appSchedule'))
)
WHERE JSON_EXTRACT(`json`, '$.appSchedule') IS NOT NULL;

UPDATE installed_apps
SET `json` = JSON_REMOVE(`json`, '$.appSchedule')
WHERE JSON_EXTRACT(`json`, '$.appSchedule') IS NOT NULL;