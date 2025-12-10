UPDATE test_definition
SET json = JSON_SET(
    json,
    '$.supportedServices',
    JSON_ARRAY('Snowflake', 'BigQuery', 'Athena', 'Redshift', 'Postgres', 'MySQL', 'Mssql', 'Oracle', 'Trino', 'SapHana')
)
WHERE name = 'tableDiff'
  AND (
    JSON_EXTRACT(json, '$.supportedServices') IS NULL
    OR JSON_LENGTH(JSON_EXTRACT(json, '$.supportedServices')) = 0
  );