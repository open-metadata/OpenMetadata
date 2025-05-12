-- Add runtime: enabled for AutoPilot
UPDATE apps_marketplace
SET json = jsonb_set(
	json::jsonb,
	'{runtime,enabled}',
	'true',
)
where name = 'AutoPilotApplication';