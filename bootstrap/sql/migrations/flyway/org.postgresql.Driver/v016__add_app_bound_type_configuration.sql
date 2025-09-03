-- Add appBoundType columns to installed_apps table
ALTER TABLE installed_apps 
ADD COLUMN appBoundType VARCHAR(256) GENERATED ALWAYS AS (json ->> 'appBoundType') STORED,

CREATE INDEX IF NOT EXISTS installed_apps_app_bound_type_index ON installed_apps(appBoundType);