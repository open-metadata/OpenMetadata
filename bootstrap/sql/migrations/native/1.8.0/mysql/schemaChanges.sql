ALTER TABLE background_jobs
ADD COLUMN runAt BIGINT;

CREATE INDEX background_jobs_run_at_index ON background_jobs(runAt);
