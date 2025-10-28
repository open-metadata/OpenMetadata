UPDATE test_definition
SET json = JSON_SET(
    json,
    '$.testPlatforms',
    CAST(REPLACE(
        JSON_EXTRACT(json, '$.testPlatforms'),
        '"DBT"',
        '"dbt"'
    ) AS JSON)
)
WHERE JSON_CONTAINS(json, '"DBT"', '$.testPlatforms');