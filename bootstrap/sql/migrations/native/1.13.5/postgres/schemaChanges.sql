-- Repairs the TestSuite half of the 1.13.0 dynamic-sampling migration.
-- 1.13.0 matched `pipelineType` against 'testSuite', but the enum value is 'TestSuite'
-- (ingestionPipeline.json#/definitions/pipelineType). PostgreSQL text comparison is
-- case-sensitive, so both statements matched zero rows and the flat sampling fields were
-- never folded into profileSampleConfig. Since testSuitePipeline.json is
-- "additionalProperties": false and no longer declares those fields, the stranded rows now
-- fail ingestion-side validation. The profiler half of 1.13.0 was unaffected.
-- Both statements carry the original guards, so replaying them is safe.

-- ingestion_pipeline_entity (TestSuite pipelines): build profileSampleConfig (skip if already migrated)
UPDATE ingestion_pipeline_entity
SET json = jsonb_set(
    json::jsonb,
    '{sourceConfig,config,profileSampleConfig}',
    jsonb_build_object(
        'sampleConfigType', 'STATIC',
        'config', jsonb_build_object(
            'profileSample', json::jsonb #> '{sourceConfig,config,profileSample}',
            'profileSampleType', COALESCE(
                json::jsonb #> '{sourceConfig,config,profileSampleType}',
                '"PERCENTAGE"'::jsonb
            ),
            'samplingMethodType', json::jsonb #> '{sourceConfig,config,samplingMethodType}'
        )
    )
)::json
WHERE json #>> '{pipelineType}' = 'TestSuite'
  AND json::jsonb #>> '{sourceConfig,config,profileSample}' IS NOT NULL
  AND json::jsonb #> '{sourceConfig,config,profileSampleConfig}' IS NULL;

-- ingestion_pipeline_entity (TestSuite pipelines): remove old flat fields
UPDATE ingestion_pipeline_entity
SET json = (json::jsonb #- '{sourceConfig,config,profileSample}'
                        #- '{sourceConfig,config,profileSampleType}'
                        #- '{sourceConfig,config,samplingMethodType}')::json
WHERE json #>> '{pipelineType}' = 'TestSuite'
  AND (json::jsonb #>> '{sourceConfig,config,profileSample}' IS NOT NULL
    OR json::jsonb #>> '{sourceConfig,config,profileSampleType}' IS NOT NULL
    OR json::jsonb #>> '{sourceConfig,config,samplingMethodType}' IS NOT NULL);
