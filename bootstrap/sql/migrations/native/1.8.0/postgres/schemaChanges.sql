-- Add runtime: enabled for AutoPilot
UPDATE apps_marketplace
SET json = jsonb_set(
	json::jsonb,
	'{runtime,enabled}',
	'true'
)
where name = 'AutoPilotApplication';

-- Add a random UUID to the appSchedule
UPDATE installed_apps
SET json = jsonb_set(
    json,
    '{appSchedule,id}',
    to_jsonb(gen_random_uuid())
)
WHERE jsonb_path_exists(json, '$.appSchedule');

-- Move appSchedule into AppSchedules as a list
UPDATE installed_apps
SET json = jsonb_set(
    json,
    '{appSchedules}',
    to_jsonb(ARRAY[jsonb_path_query(json, '$.appSchedule')])
)
WHERE jsonb_path_exists(json, '$.appSchedule');

-- Remove the appSchedule field
UPDATE installed_apps
SET json = jsonb - 'appSchedule'
WHERE jsonb_path_exists(json, '$.appSchedule');