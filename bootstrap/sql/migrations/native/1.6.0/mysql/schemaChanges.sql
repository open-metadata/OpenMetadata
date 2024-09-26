-- Extend app extension for limits
ALTER TABLE apps_extension_time_series ADD COLUMN extension VARCHAR(255);
UPDATE apps_extension_time_series SET extension = 'status' WHERE extension IS NULL;
ALTER TABLE apps_extension_time_series MODIFY COLUMN extension VARCHAR(255) NOT NULL;

-- Clean dangling workflows not removed after test connection
truncate automations_workflow;