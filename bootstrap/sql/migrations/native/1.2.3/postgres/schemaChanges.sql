
-- fixed Query for updating viewParsingTimeoutLimit
UPDATE ingestion_pipeline_entity
SET json = jsonb_set(
  json::jsonb #- '{sourceConfig,config,viewParsingTimeoutLimit}',
  '{sourceConfig,config,queryParsingTimeoutLimit}',
  (json #> '{sourceConfig,config,viewParsingTimeoutLimit}')::jsonb,
  true
)
WHERE json #>> '{pipelineType}' = 'metadata'
AND json #>> '{sourceConfig,config,type}' = 'DatabaseMetadata'
AND json #>> '{sourceConfig,config,viewParsingTimeoutLimit}' is not null;

