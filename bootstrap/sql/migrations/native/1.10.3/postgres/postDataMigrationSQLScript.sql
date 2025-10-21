UPDATE test_definition
SET json = jsonb_set(
    json::jsonb,
    '{supportedDataTypes}',
    (json->'supportedDataTypes')::jsonb || '"NUMERIC"'::jsonb,
    true
)
WHERE json->'supportedDataTypes' @> '"NUMBER"'::jsonb
  AND NOT (json->'supportedDataTypes' @> '"NUMERIC"'::jsonb);

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