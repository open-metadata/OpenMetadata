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
