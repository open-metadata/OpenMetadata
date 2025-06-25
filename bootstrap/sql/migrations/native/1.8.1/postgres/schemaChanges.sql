-- Composite index for apps_extension_time_series to fix query performance
-- Create index only if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_apps_extension_composite 
ON apps_extension_time_series(appId, extension, timestamp DESC);