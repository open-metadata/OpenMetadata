-- Extend app extension for limits
ALTER TABLE apps_extension_time_series ADD COLUMN extension VARCHAR(255);
UPDATE apps_extension_time_series SET extension = 'status' WHERE extension IS NULL;
ALTER TABLE apps_extension_time_series MODIFY COLUMN extension VARCHAR(255) NOT NULL;
CREATE INDEX apps_extension_time_series_extension ON apps_extension_time_series(extension);

-- Clean dangling workflows not removed after test connection
truncate automations_workflow;

-- Migrate api service type from 'REST' to 'Rest'
UPDATE api_service_entity
SET json = JSON_SET(json, '$.connection.config.type', 'Rest')
WHERE JSON_EXTRACT(json, '$.connection.config.type') in ('REST');