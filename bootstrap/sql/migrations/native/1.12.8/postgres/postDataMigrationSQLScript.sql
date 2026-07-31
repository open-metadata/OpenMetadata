-- Fix PII classification autoClassificationConfig (issue #27910)
UPDATE classification
SET json = jsonb_set(
    json::jsonb,
    '{autoClassificationConfig}',
    '{"enabled": true, "conflictResolution": "highest_priority", "minimumConfidence": 0.6, "requireExplicitMatch": true}'::jsonb
)::json
WHERE json->>'name' = 'PII'
  AND json->'autoClassificationConfig'->>'enabled' IS NULL;

-- Fix PII tags autoClassificationEnabled (issue #27910)
UPDATE tag
SET json = jsonb_set(json::jsonb, '{autoClassificationEnabled}', 'true'::jsonb)::json
WHERE json->'classification'->>'name' = 'PII'
  AND json->>'name' IN ('NonSensitive', 'Sensitive')
  AND (
    json->>'autoClassificationEnabled' IS NULL
    OR (json->>'autoClassificationEnabled')::boolean = false
  );
