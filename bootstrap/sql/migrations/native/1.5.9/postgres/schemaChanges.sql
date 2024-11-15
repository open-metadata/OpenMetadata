-- Extend app extension for limits
ALTER TABLE apps_extension_time_series ADD COLUMN extension VARCHAR(255);
UPDATE apps_extension_time_series SET extension = 'status' WHERE extension IS NULL;
ALTER TABLE apps_extension_time_series ALTER COLUMN extension SET NOT NULL;
CREATE INDEX IF NOT EXISTS apps_extension_time_series_extension ON apps_extension_time_series(extension);