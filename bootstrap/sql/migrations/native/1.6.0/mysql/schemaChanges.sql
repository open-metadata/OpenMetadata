-- Extend app extension for limits
ALTER TABLE apps_extension_time_series ADD COLUMN extension VARCHAR(255);
UPDATE apps_extension_time_series SET extension = 'status' WHERE extension IS NULL;
ALTER TABLE apps_extension_time_series MODIFY COLUMN extension VARCHAR(255) NOT NULL;
CREATE INDEX apps_extension_time_series_extension ON apps_extension_time_series(extension);

-- Clean dangling workflows not removed after test connection
truncate automations_workflow;

-- App Data Store
CREATE TABLE IF NOT EXISTS apps_data_store (
    identifier VARCHAR(256) NOT NULL,      
    type VARCHAR(256) NOT NULL,   
    json JSON NOT NULL
);