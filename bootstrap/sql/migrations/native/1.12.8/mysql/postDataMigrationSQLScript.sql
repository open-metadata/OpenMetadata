-- Fix PII classification autoClassificationConfig (issue #27910)
UPDATE classification
SET json = JSON_SET(
    json,
    '$.autoClassificationConfig',
    CAST('{"enabled": true, "conflictResolution": "highest_priority", "minimumConfidence": 0.6, "requireExplicitMatch": true}' AS JSON)
)
WHERE JSON_VALUE(json, '$.name' RETURNING CHAR) = 'PII'
  AND JSON_EXTRACT(json, '$.autoClassificationConfig.enabled') IS NULL;

-- Fix PII tags autoClassificationEnabled (issue #27910)
UPDATE tag
SET json = JSON_SET(json, '$.autoClassificationEnabled', CAST('true' AS JSON))
WHERE JSON_VALUE(json, '$.classification.name' RETURNING CHAR) = 'PII'
  AND JSON_VALUE(json, '$.name' RETURNING CHAR) IN ('NonSensitive', 'Sensitive')
  AND (
    JSON_EXTRACT(json, '$.autoClassificationEnabled') IS NULL
    OR JSON_EXTRACT(json, '$.autoClassificationEnabled') = false
  );
