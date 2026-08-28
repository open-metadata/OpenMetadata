UPDATE ingestion_pipeline_entity
SET json = (json::jsonb #- '{sourceConfig,config,computeMetrics}')::json
WHERE json::jsonb -> 'sourceConfig' -> 'config' -> 'computeMetrics' IS NOT NULL
AND pipelineType = 'profiler';

-- Normalize user emails to lowercase: email is the primary identity lookup key and the
-- application always compares lowercased values. Rows whose lowercased email would collide
-- with another user's are left untouched so the migration cannot fail; those require manual
-- resolution.
UPDATE user_entity ue
SET json = jsonb_set(ue.json, '{email}', to_jsonb(lower(ue.json ->> 'email')))
WHERE ue.json ->> 'email' <> lower(ue.json ->> 'email')
AND NOT EXISTS (
    SELECT 1 FROM user_entity o
    WHERE o.id <> ue.id
    AND lower(o.json ->> 'email') = lower(ue.json ->> 'email')
);
