UPDATE ingestion_pipeline_entity
SET json = JSON_REMOVE(json, '$.sourceConfig.config.computeMetrics')
WHERE JSON_EXTRACT(json, '$.sourceConfig.config.computeMetrics') IS NOT NULL
AND pipelineType = 'profiler';


-- Normalize user emails to lowercase: email is the primary identity lookup key and the
-- application always compares lowercased values. The case-insensitive unique key on email
-- guarantees no collisions can result from lowercasing.
UPDATE user_entity
SET json = JSON_SET(json, '$.email', LOWER(JSON_UNQUOTE(JSON_EXTRACT(json, '$.email'))))
WHERE BINARY JSON_UNQUOTE(JSON_EXTRACT(json, '$.email')) <> LOWER(JSON_UNQUOTE(JSON_EXTRACT(json, '$.email')));
