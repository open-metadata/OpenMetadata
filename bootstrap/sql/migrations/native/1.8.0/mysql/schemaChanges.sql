ALTER TABLE background_jobs
ADD COLUMN runAt BIGINT;

CREATE INDEX background_jobs_run_at_index ON background_jobs(runAt);

-- Add runtime: enabled for AutoPilot
UPDATE apps_marketplace
SET json = JSON_SET(
    json,
    '$.runtime.enabled',
    true
)
WHERE name = 'AutoPilotApplication';
