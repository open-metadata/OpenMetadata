-- DataInsightsApplication should not allow configuration
UPDATE apps_marketplace
SET json = jsonb_set(
	json::jsonb,
	'{allowConfiguration}',
	to_jsonb(false)
)
where name = 'DataInsightsApplication';

UPDATE installed_apps
SET json = jsonb_set(
	json::jsonb,
	'{allowConfiguration}',
	to_jsonb(false)
)
where name = 'DataInsightsApplication';
