UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{supportedServices}',
    '["Snowflake", "BigQuery", "Athena", "Redshift", "Postgres", "MySQL", "Mssql", "Oracle", "Trino", "SapHana"]'::jsonb
)
WHERE name = 'tableDiff'
  AND (
    json->'supportedServices' IS NULL
    OR json->'supportedServices' = '[]'::jsonb
  );

UPDATE
    classification
SET
    json = json::jsonb || json_build_object(
        'autoClassificationConfig', json_build_object(
            'enabled', true,
            'conflictResolution', 'highest_priority',
            'minimumConfidence', 0.6,
            'requireExplicitMatch', true
        )
    )::jsonb
WHERE
    json->>'name' = 'PII';
