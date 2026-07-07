-- Backfill reverseIngestionWorkflowRetentionPeriod for existing DataRetentionApplication installs
UPDATE installed_apps
SET json = jsonb_set(
    json::jsonb,
    '{appConfiguration,reverseIngestionWorkflowRetentionPeriod}',
    '30'::jsonb
)::json
WHERE json->>'name' = 'DataRetentionApplication'
  AND json->'appConfiguration'->>'reverseIngestionWorkflowRetentionPeriod' IS NULL;
