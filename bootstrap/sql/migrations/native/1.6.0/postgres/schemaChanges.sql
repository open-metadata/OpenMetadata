-- Clean dangling workflows not removed after test connection
truncate automations_workflow;

-- App Data Store
CREATE TABLE IF NOT EXISTS apps_data_store (
    identifier VARCHAR(256) NOT NULL,      
    type VARCHAR(256) NOT NULL,   
    json JSON NOT NULL
);