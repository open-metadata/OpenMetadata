-- Backfill reverseIngestionWorkflowRetentionPeriod for existing DataRetentionApplication installs
UPDATE installed_apps
SET json = JSON_SET(
    json,
    '$.appConfiguration.reverseIngestionWorkflowRetentionPeriod', 30
)
WHERE JSON_EXTRACT(json, '$.name') = 'DataRetentionApplication'
  AND JSON_EXTRACT(json, '$.appConfiguration.reverseIngestionWorkflowRetentionPeriod') IS NULL;
