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

UPDATE
    classification
SET
    json = JSON_SET(
        json,
        '$.autoClassificationConfig',
        CAST(
            '{"enabled": true, "conflictResolution": "highest_priority", "minimumConfidence": 0.6, "requireExplicitMatch": true}'
            AS JSON
        )
    )
WHERE
    JSON_VALUE(json, '$.name' RETURNING CHAR) = 'PII';