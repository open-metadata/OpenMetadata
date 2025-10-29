UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{testPlatforms}',
    REPLACE(
        (json::jsonb -> 'testPlatforms')::text,
        '"DBT"',
        '"dbt"'
    )::jsonb
)::json
WHERE json::jsonb -> 'testPlatforms' @> '"DBT"'::jsonb;

-- Delete searchSettings to force reload from packaged searchSettings.json with field-based aggregations
DELETE FROM openmetadata_settings WHERE configType='searchSettings';