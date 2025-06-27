-- Add runId column for querying application logs
ALTER TABLE apps_extension_time_series
ADD COLUMN runId VARCHAR(255) GENERATED ALWAYS AS ((json ->> 'runId')) STORED;

CREATE INDEX apps_extension_time_series_run_id_index ON apps_extension_time_series (runId);