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
