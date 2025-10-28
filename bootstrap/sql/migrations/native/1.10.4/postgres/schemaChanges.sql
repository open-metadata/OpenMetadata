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