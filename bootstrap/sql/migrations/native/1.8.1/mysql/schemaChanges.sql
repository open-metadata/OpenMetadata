-- Composite index for apps_extension_time_series to fix "Out of sort memory" error
-- This index optimizes the query: WHERE appId = ? AND extension = ? ORDER BY timestamp DESC
CREATE INDEX idx_apps_extension_composite 
ON apps_extension_time_series(appId, extension, timestamp DESC);