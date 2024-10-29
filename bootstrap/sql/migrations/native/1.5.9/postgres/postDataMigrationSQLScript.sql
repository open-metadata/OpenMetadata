ALTER TABLE apps_extension_time_series ADD COLUMN appName VARCHAR(256) GENERATED ALWAYS AS (json ->> 'appName') STORED NOT NULL;
