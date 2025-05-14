ALTER TABLE background_jobs
ADD COLUMN runAt BIGINT;

ALTER TABLE `background_jobs` ADD INDEX `background_jobs_run_at_index` (`runAt`);

-- Add runtime: enabled for AutoPilot
UPDATE apps_marketplace
SET json = jsonb_set(
	json::jsonb,
	'{runtime,enabled}',
	'true'
)
where name = 'AutoPilotApplication';
