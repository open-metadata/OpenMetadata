-- Repairs the TestSuite half of the 1.13.0 dynamic-sampling migration.
-- 1.13.0 matched `pipelineType` against 'testSuite', but the enum value is 'TestSuite'
-- (ingestionPipeline.json#/definitions/pipelineType). On the default utf8mb4_0900_ai_ci
-- collation MySQL matched anyway, so most deployments already migrated and these statements
-- are a no-op. They are replayed here for deployments whose `pipelineType` column carries a
-- case-sensitive collation (e.g. utf8mb4_bin / utf8mb4_0900_as_cs), where 1.13.0 silently
-- matched zero rows -- the same failure PostgreSQL hit unconditionally.
-- Duplicated from the 1.13.5 migration because MigrationWorkflow is release-train aware:
-- a deployment upgrading within the 2.0.x train must not depend on the 1.13.x copy running.
-- Both statements carry the original guards, so replaying them is safe.

-- ingestion_pipeline_entity (TestSuite pipelines): build profileSampleConfig (skip if already migrated)
UPDATE ingestion_pipeline_entity
SET json = JSON_SET(
    json,
    '$.sourceConfig.config.profileSampleConfig',
    JSON_OBJECT(
        'sampleConfigType', 'STATIC',
        'config', JSON_OBJECT(
            'profileSample', JSON_EXTRACT(json, '$.sourceConfig.config.profileSample'),
            'profileSampleType', COALESCE(
                JSON_EXTRACT(json, '$.sourceConfig.config.profileSampleType'),
                CAST('"PERCENTAGE"' AS JSON)
            ),
            'samplingMethodType', JSON_EXTRACT(json, '$.sourceConfig.config.samplingMethodType')
        )
    )
)
WHERE pipelineType = 'TestSuite'
  AND JSON_EXTRACT(json, '$.sourceConfig.config.profileSample') IS NOT NULL
  AND JSON_TYPE(JSON_EXTRACT(json, '$.sourceConfig.config.profileSample')) != 'NULL'
  AND NOT JSON_CONTAINS_PATH(json, 'one', '$.sourceConfig.config.profileSampleConfig');

-- ingestion_pipeline_entity (TestSuite pipelines): remove old flat fields
UPDATE ingestion_pipeline_entity
SET json = JSON_REMOVE(
    JSON_REMOVE(
        JSON_REMOVE(json, '$.sourceConfig.config.samplingMethodType'),
        '$.sourceConfig.config.profileSampleType'
    ),
    '$.sourceConfig.config.profileSample'
)
WHERE pipelineType = 'TestSuite'
  AND (JSON_CONTAINS_PATH(json, 'one', '$.sourceConfig.config.profileSample')
    OR JSON_CONTAINS_PATH(json, 'one', '$.sourceConfig.config.profileSampleType')
    OR JSON_CONTAINS_PATH(json, 'one', '$.sourceConfig.config.samplingMethodType'));
