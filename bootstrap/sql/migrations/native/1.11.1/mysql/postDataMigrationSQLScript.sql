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